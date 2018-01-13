// http://www.movable-type.co.uk/scripts/latlong.html
Number.prototype.toRad = function() {
   return this * Math.PI / 180;
}

Number.prototype.toDeg = function() {
   return this * 180 / Math.PI;
}

google.maps.LatLng.prototype.destinationPoint = function(brng, dist) {
   dist = dist / 3959;  
   brng = brng.toRad();  

   var lat1 = this.lat().toRad(), lon1 = this.lng().toRad();

   var lat2 = Math.asin(Math.sin(lat1) * Math.cos(dist) + 
                        Math.cos(lat1) * Math.sin(dist) * Math.cos(brng));

   var lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(dist) *
                                Math.cos(lat1), 
                                Math.cos(dist) - Math.sin(lat1) *
                                Math.sin(lat2));

   if (isNaN(lat2) || isNaN(lon2)) return null;

   return new google.maps.LatLng(lat2.toDeg(), lon2.toDeg());
}

// -------
min = function(a, b) {
   if (a < b) {
      return a;
   }
   return b;
}

distance = function(pointA, pointB) {
   var r = 3959;
   var lat1 = pointA.lat().toRad();
   var lat2 = pointB.lat().toRad();
   var latDiff = (pointB.lat() - pointA.lat()).toRad();
   var lngDiff = (pointB.lng() - pointA.lng()).toRad();

   var a = Math.sin(latDiff/2) * Math.sin(latDiff/2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(lngDiff/2) * Math.sin(lngDiff/2);
   var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

   return r * c;
}

// init
var apiKeys = {};
var startAddress = "";
var startCoordinates = {};
var runLength = 0; // miles
var radius = 0;

document.getElementById("submitButton").disabled = true;
document.getElementById("displayRoutesButton").disabled = true;
document.getElementById("cancelDisplayRoutesButton").disabled = true;

$.getJSON("api_keys.json", function(data) {
   $.each(data, function(key, val) {
      apiKeys[key] = val;
   });
   document.getElementById("submitButton").disabled = false;
});

meters = function(miles) {
   return 1609.34 * miles;
}

miles = function(meters) {
   return meters * 0.000621371;
}

updateMap = function() {
   startAddress = document.getElementById("address").value;
   runLength = document.getElementById("mileage").value;
   // get coordinates
   $.get('https://maps.googleapis.com/maps/api/geocode/json', {
      address: startAddress
      //key: apiKeys["geocoding"] key unnecessary ??
   }, function(data) {
      startCoordinates["lat"] = data["results"][0]["geometry"]["location"]["lat"];
      startCoordinates["lng"] = data["results"][0]["geometry"]["location"]["lng"];
      updateDrawing(startCoordinates);
   });
}

updateDrawing = function(startCoordinates) {
   var startPoint = new google.maps.LatLng(startCoordinates["lat"], startCoordinates["lng"]);   // Circle center
   radius = runLength / 2; // in miles

   var mapOpt = { 
      mapTypeId: google.maps.MapTypeId.TERRAIN,
      center: startPoint,
      zoom: 10 // adjust zoom based on size of circle
   };

   var map = new google.maps.Map(document.getElementById("map"), mapOpt);

   // Draw the circle
   new google.maps.Circle({
      center: startPoint,
      radius: meters(radius),
      fillColor: '#FF0000',
      fillOpacity: 0.2,
      map: map
   });

   // Show marker at circle center
   new google.maps.Marker({
      position: startPoint,
      map: map
   });

   // pick evenly spaced points for nearest roads
   var points = [];
   var pointsParameter = "";
   for (var degree = 0; degree < 360; degree += 3.6) {
      var dest = startPoint.destinationPoint(degree, radius)
      points.push(dest);
      pointsParameter += dest.lat() + "," + dest.lng() + "|";
   }
   pointsParameter = pointsParameter.substring(0, pointsParameter.length - 1);

   // find nearest roads on circumference
   var circumferencePoints = [];
   var circPointsNum = 0;
   $.get('https://roads.googleapis.com/v1/nearestRoads', {
      points: pointsParameter,
      key: apiKeys["roads"]
   }, function(data) {
      for (var i = 0; i < data["snappedPoints"].length; i++) {
         var newCircPoint = {};
         newCircPoint["lat"] = data["snappedPoints"][i]["location"]["latitude"];
         newCircPoint["lng"] = data["snappedPoints"][i]["location"]["longitude"];
         circPointsNum = circumferencePoints.length;
         if (circPointsNum > 0) {
            if (circumferencePoints[circPointsNum - 1]["lat"] != newCircPoint["lat"] || circumferencePoints[circPointsNum - 1]["lng"] != newCircPoint["lng"]) {
               circumferencePoints.push(newCircPoint);
            }
         } else {
            circumferencePoints.push(newCircPoint);
         }
      }
      circPointsNum = circumferencePoints.length;
      if (circPointsNum > 1) {
         if (circumferencePoints[0]["lat"] == circumferencePoints[circPointsNum - 1]["lat"] && circumferencePoints[0]["lng"] == circumferencePoints[circPointsNum - 1]["lng"]) {
            circumferencePoints.pop();
         }
      }

      // place points at intersecting roads on circumference
      for (var i = 0; i < circPointsNum; i++) {
         new google.maps.Marker({
            position: new google.maps.LatLng(circumferencePoints[i]["lat"], circumferencePoints[i]["lng"]),
            icon: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
            map: map
         });
      }
      document.getElementById("displayRoutesButton").disabled = false;
      $('#displayRoutesButton').on('click', function() {
         showRoutes(map, startPoint, circumferencePoints);
         document.getElementById("cancelDisplayRoutesButton").disabled = false;
      });
   });
}

showRoutes = function(map, startPoint, circumferencePoints) {
   var directionsService = new google.maps.DirectionsService;
   var pause = 0;
   var iters = 1;

   //circumferencePoints.length
   for (var index = 0; index < circumferencePoints.length; index += iters) {
      mapRoutes(map, directionsService, startPoint, circumferencePoints, index, iters, pause);
      pause += 1000; // add one second pause (only `iters` requests per second) TODO: update to retry failures
      // TODO: allow breaking out of this loop
   }
}

mapRoutes = function(map, directionsService, startPoint, circumferencePoints, startIndex, iters, pause) {
   setTimeout(function() {
      for (var i = startIndex; i < min(startIndex + iters, circumferencePoints.length); i++) {
         mapRoute(map, directionsService, startPoint, circumferencePoints[i]);
      }
   }, pause);
}

mapRoute = function(map, directionsService, startPoint, destPoint) {
   directionsService.route({
      origin: startPoint,
      destination: destPoint,
      travelMode: google.maps.DirectionsTravelMode.WALKING
   }, function(response, status) {
      if (status == 'OK') {
         var directionsDisplay = new google.maps.DirectionsRenderer({
            suppressMarkers: true, 
            preserveViewport: true
         });
         directionsDisplay.setMap(map);
         directionsDisplay.setDirections(response);

         console.log(response);
         shortenRoute(map, radius, response, function(map, finalPoint) {
            new google.maps.Marker({
               position: new google.maps.LatLng(finalPoint.lat(), finalPoint.lng()),
               icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
               map: map
            });
         });
      } else {
         console.log(status);
      }
   });
}

shortenRoute = function(map, length, directions, callback) {
   var travelDistance = 0;
   var stepLength = 0;
   var finalPoint;
   for (var i = 0; i < directions["routes"][0]["legs"][0]["steps"].length; i++) {
      //console.log("dist: " + directions["routes"][0]["legs"][0]["steps"][i]["distance"]);
      stepLength = miles(directions["routes"][0]["legs"][0]["steps"][i]["distance"]["value"]);
      if (travelDistance + stepLength > length) {
         for (var j = 0; j < directions["routes"][0]["legs"][0]["steps"][i]["path"].length - 1; j++) {
            travelDistance += distance(directions["routes"][0]["legs"][0]["steps"][i]["path"][j], directions["routes"][0]["legs"][0]["steps"][i]["path"][j + 1]);
            if (travelDistance > length) {
               finalPoint = new google.maps.LatLng(directions["routes"][0]["legs"][0]["steps"][i]["path"][j + 1].lat(), directions["routes"][0]["legs"][0]["steps"][i]["path"][j + 1].lng());
               break;
            }
         }
         break;
      } else {
         travelDistance += stepLength;
         finalPoint = new google.maps.LatLng(directions["routes"][0]["legs"][0]["steps"][i]["end_point"].lat(), directions["routes"][0]["legs"][0]["steps"][i]["end_point"].lng());
      }
   }
   // directions["route"][0]["steps"]

   callback(map, finalPoint);

   return finalPoint;
}




















