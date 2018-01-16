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

// distance = function(pointA, pointB) {
//    var r = 3959;
//    var lat1 = pointA.lat().toRad();
//    var lat2 = pointB.lat().toRad();
//    var latDiff = (pointB.lat() - pointA.lat()).toRad();
//    var lngDiff = (pointB.lng() - pointA.lng()).toRad();

//    var a = Math.sin(latDiff/2) * Math.sin(latDiff/2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(lngDiff/2) * Math.sin(lngDiff/2);
//    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

//    return r * c;
// }

// init
var apiKeys = {};
var startAddress = "";
var startCoordinates = {};
var runLength = 0; // miles
var radius = 0;

var numRoutesToCheck = 100;
var checkedRoutes = 0;

var possibleRoutes = [];

var clickedMarker = undefined;
var selectedRouteInfo = undefined;
var clickedRouteInfo = undefined;

document.getElementById("submitButton").disabled = true;
document.getElementById("displayRoutesButton").disabled = true;
//document.getElementById("cancelDisplayRoutesButton").disabled = true;

$.getJSON("api_keys.json", function(data) {
   $.each(data, function(key, val) {
      apiKeys[key] = val;
   });
   document.getElementById("submitButton").disabled = false;
});

$("#info_form").submit(function(e) {
    e.preventDefault();
    updateMap();
});

meters = function(miles) {
   return 1609.34 * miles;
}

miles = function(meters) {
   return meters * 0.000621371;
}

comparePoints = function(firstPoint, pointA, pointB) {
   return google.maps.geometry.spherical.computeDistanceBetween(firstPoint, pointA) - google.maps.geometry.spherical.computeDistanceBetween(firstPoint, pointB);
}

updateMap = function() {
   checkedRoutes = 0;
   document.getElementById("loadingLabelStart").innerHTML = "";
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
      zoom: 10 //Math.round(100 / runLength) // adjust zoom based on size of circle
   };

   var map = new google.maps.Map(document.getElementById("map"), mapOpt);

   // Draw the circle
   // new google.maps.Circle({
   //    center: startPoint,
   //    radius: meters(radius),
   //    fillColor: '#FF0000',
   //    fillOpacity: 0.2,
   //    map: map
   // });

   // Show marker at circle center
   new google.maps.Marker({
      position: startPoint,
      map: map
   });

   // pick evenly spaced points for nearest roads
   var points = [];
   var pointsParameter = "";
   for (var degree = 0; degree < 360; degree += 360/numRoutesToCheck) {
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
         var newCircPoint = new google.maps.LatLng(data["snappedPoints"][i]["location"]["latitude"], data["snappedPoints"][i]["location"]["longitude"]);
         circPointsNum = circumferencePoints.length;
         if (circPointsNum > 0) {
            if (circumferencePoints[circPointsNum - 1].lat() != newCircPoint.lat() || circumferencePoints[circPointsNum - 1].lng() != newCircPoint.lng()) {
               circumferencePoints.push(newCircPoint);
            }
         } else {
            circumferencePoints.push(newCircPoint);
         }
      }
      circPointsNum = circumferencePoints.length;
      if (circPointsNum > 1) {
         if (circumferencePoints[0].lat() == circumferencePoints[circPointsNum - 1].lat() && circumferencePoints[0].lng() == circumferencePoints[circPointsNum - 1].lng()) {
            circumferencePoints.pop();
         }
      }

      // place points at intersecting roads on circumference
      // for (var i = 0; i < circPointsNum; i++) {
      //    new google.maps.Marker({
      //       position: new google.maps.LatLng(circumferencePoints[i]["lat"], circumferencePoints[i]["lng"]),
      //       icon: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
      //       map: map
      //    });
      // }
      document.getElementById("displayRoutesButton").disabled = false;
      $('#displayRoutesButton').on('click', function() {
         showRoutes(map, startPoint, circumferencePoints);
         //document.getElementById("cancelDisplayRoutesButton").disabled = false;
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
   document.getElementById("loadingLabelEnd").innerHTML = "/" + circumferencePoints.length + " ROUTES CHECKED";
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
         directionsDisplay.setOptions({
            polylineOptions: {
             strokeColor: '#0000FF',
             strokeOpacity: 0.6,
             strokeWeight: 6,
             zIndex: 1
            }
         });
         directionsDisplay.setMap(map);

         shortenRoute(map, directionsDisplay, radius, response, function(map, directionsDisplays, adjustedInfo) {
            for (var i = 0; i < adjustedInfo.length; i++) { // if there are multiple routes to the same location
               var finalPoint = adjustedInfo[i]["finalPoint"];
               var newSteps = adjustedInfo[i]["newSteps"];
               var newDistance = adjustedInfo[i]["newDistance"];
               var newPath = adjustedInfo[i]["newPath"];
               if (i > 0 && finalPoint.lat() == adjustedInfo[i-1]["finalPoint"].lat() && finalPoint.lng() == adjustedInfo[i-1]["finalPoint"].lng()) {
                  continue;
               }
               
               // drawRoute(directionsDisplay, finalPoint, newSteps, newDistance, newPath, response, i);
               if (possibleRoutes.length == 0 || 
                  (google.maps.geometry.spherical.computeDistanceBetween(finalPoint, possibleRoutes[possibleRoutes.length - 1]["finalPoint"]) > 5 && 
                     google.maps.geometry.spherical.computeDistanceBetween(finalPoint, possibleRoutes[0]["finalPoint"]) > 5)) {

                  possibleRoutes.push(adjustedInfo[i]);
                  var destMarker = new google.maps.Marker({
                     position: new google.maps.LatLng(finalPoint.lat(), finalPoint.lng()),
                     icon: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                     map: map
                  });
                  drawRoute(directionsDisplays[i], adjustedInfo[i], response, i, function(info) {
                     addListeners(map, destMarker, info);
                  });
               }
               checkedRoutes++;
               document.getElementById("loadingLabelStart").innerHTML = checkedRoutes;
            }
         });
      } else {
         console.log(status);
      }
   });
}

addListeners = function(map, destMarker, info) {
   destMarker.addListener('click', function() {
      selectedRouteInfo = clickedRouteInfo;
      clickedRouteInfo = undefined;
      unhighlightRoute(map);

      if (clickedMarker != destMarker) { // if marker is clicked again, only unhighlight
         clickedMarker = destMarker;

         var directionsBox = document.getElementById("directionsBox").getElementsByTagName("ol")[0];
         directionsBox.innerHTML = "Directions: " + info["newDistance"] + " miles one-way, <b>" + info["newDistance"] * 2 + " miles</b> round-trip";
         for (var i = 0; i < info["newSteps"].length; i++) {
            directionsBox.innerHTML += "<li>" + info["newSteps"][i]["instructions"] + " for " + info["newSteps"][i]["distance"]["text"];
         }

         highlightRoute(map, info, '#00FF00');
         clickedRouteInfo = info;
      } else {
         document.getElementById("directionsBox").getElementsByTagName("ol")[0].innerHTML = "";
         clickedMarker = undefined;
         selectedRouteInfo = undefined;
      }
   });

   destMarker.addListener('mouseover', function() {
      var finalAddress = info["directionsDisplay"]["directions"]["geocoded_waypoints"][1]["formatted_address"];
      var infoWindow = new google.maps.InfoWindow({
         content: finalAddress + "<br \> <b>" + info["newDistance"] * 2 + " miles round-trip",
         disableAutoPan: true
      });
      infoWindow.open(map, destMarker);

      destMarker.addListener('mouseout', function() {
         infoWindow.close(map, destMarker);
         if (clickedMarker != destMarker) {
            unhighlightRoute(map);
         }
      });

      if (clickedMarker != destMarker) {
         highlightRoute(map, info, '#FF0000');
      }
   });
}

highlightRoute = function(map, routeInfo, color) {
   //unhighlightRoute(map);

   routeInfo["directionsDisplay"].setMap(null);
   routeInfo["directionsDisplay"].setOptions({
      polylineOptions: {
         strokeColor: color,
         strokeOpacity: 1.0,
         strokeWeight: 6,
         zIndex: 2
      }
   });
   routeInfo["directionsDisplay"].setMap(map);
   selectedRouteInfo = routeInfo;

   // // set previous selected route back to blue
   // if (selectedRoutePolyline != undefined) {
   //    selectedRoutePolyline.setMap(null);
   // }

   // // set route red
   // selectedRoutePolyline = new google.maps.Polyline({
   //     path: routeInfo["directionsDisplay"]["directions"]["routes"][0]["overview_path"],
   //     geodesic: true,
   //     strokeColor: '#FF0000',
   //     strokeOpacity: 1.0,
   //     strokeWeight: 6,
   //     zIndex: 2
   //   });

   // selectedRoutePolyline.setMap(map);
}

unhighlightRoute = function(map) {
   if (selectedRouteInfo != undefined) {
      // unhighlight old route
      selectedRouteInfo["directionsDisplay"].setMap(null);
      selectedRouteInfo["directionsDisplay"].setOptions({
         polylineOptions: {
            strokeColor: '#0000FF',
            strokeOpacity: 0.6,
            strokeWeight: 6,
            zIndex: 1
         }
      });
      selectedRouteInfo["directionsDisplay"].setMap(map);
   }
}

shortenRoute = function(map, directionsDisplay, length, directions, callback) {
   var returnArray = [];

   var travelDistance = 0;
   var stepLength = 0;
   // var steps = directions["routes"][0]["legs"][0]["steps"];
   var routes = directions["routes"];
   var finalPoints = []; // modified destinations for each route
   var newSteps = []; // modified steps for each route
   var newPaths = []; // modified overview paths for each route
   var newDistances = [];

   var directionsDisplays = [directionsDisplay];
   // var newLeg;
   for (var r = 0; r < routes.length; r++) {
      var steps = routes[r]["legs"][0]["steps"]; // TODO: check what the legs are?
      var finalPoint; // modified destination for route r
      var newStepSet = []; // modified steps for route r
      var newPathSet = []; // modified overview path for route r
      for (var i = 0; i < steps.length; i++) {
         stepLength = miles(steps[i]["distance"]["value"]);
         if (travelDistance + stepLength > length) {
            stepLength = 0;
            var newPath = [];
            newPath.push(steps[i]["path"][0]);
            for (var j = 0; j < steps[i]["path"].length - 1; j++) {
               stepLength += miles(google.maps.geometry.spherical.computeDistanceBetween(steps[i]["path"][j], steps[i]["path"][j + 1]));
               newPath.push(steps[i]["path"][j + 1]);
               if (travelDistance + stepLength > length) {
                  travelDistance += stepLength;
                  finalPoint = new google.maps.LatLng(steps[i]["path"][j + 1].lat(), steps[i]["path"][j + 1].lng());
                  break;
               }
            }
            newPathSet = newPathSet.concat(newPath);
            newStepSet.push({
               distance: {text: Math.round(stepLength * 100)/100 + " mi", value: meters(stepLength)},
               end_location: finalPoint,
               instructions: steps[i]["instructions"],
               path: newPath,
               start_location: steps[i]["start_location"],
               travel_mode: steps[i]["travel_mode"]
            });
            break;
         } else {
            travelDistance += stepLength;
            finalPoint = new google.maps.LatLng(steps[i]["end_point"].lat(), steps[i]["end_point"].lng());
            newPathSet = newPathSet.concat(steps[i]["path"]);
            newStepSet.push(steps[i]);
         }
      }
      // finalPoints.push(finalPoint);
      // newPaths.push(newPathSet);
      // newSteps.push(newStepSet);
      // newDistances.push(travelDistance);

      if (r > 0) {
         directionsDisplays.push(new google.maps.DirectionsRenderer({
            suppressMarkers: true, 
            preserveViewport: true
         }));
      }

      returnArray.push({
         directionsDisplay: directionsDisplays[r],
         finalPoint: finalPoint,
         newPath: newPathSet,
         newSteps: newStepSet,
         newDistance: Math.round(travelDistance * 100)/100,
      });
   }
   // directions["route"][0]["steps"]

   // callback(map, directionsDisplay, {
   //    finalPoints: finalPoints, 
   //    newSteps: newSteps,
   //    newDistances: newDistances,
   //    newPaths: newPaths
   // });

   callback(map, directionsDisplays, returnArray);

   return returnArray;

}

// drawRoute = function(directionsDisplay, finalPoint, newSteps, newDistance, newPath, response, routeNum) {
drawRoute = function(directionsDisplay, routeInfo, response, routeNum, callback) {
   var finalPoint = routeInfo["finalPoint"];
   var newSteps = routeInfo["newSteps"];
   var newDistance = routeInfo["newDistance"];
   var newPath = routeInfo["newPath"];

   // reverse geocode destination point
   $.get('https://maps.googleapis.com/maps/api/geocode/json', {
      latlng: finalPoint.lat() + "," + finalPoint.lng()
   }, function(data) {
      // TODO: occasionally data["results"][0] is undefined
      var currentRouteSpecs = response["routes"][routeNum];
      var waypoints = response["geocoded_waypoints"];
      waypoints[1] = data["results"][0];
      var routes = []
      routes.push({
         bounds: currentRouteSpecs["bounds"],
         copyrights: currentRouteSpecs["copyrights"],
         legs: [{
            distance: {text: newDistance + " mi", value: meters(newDistance)},
            end_address: data["results"][0]["formatted_address"],
            end_location: finalPoint,
            start_address: currentRouteSpecs["start_address"],
            start_location: currentRouteSpecs["start_location"],
            steps: newSteps
         }],
         overview_path: newPath,
         warnings: currentRouteSpecs["warnings"],
         waypoint_order: currentRouteSpecs["waypoint_order"]
      });

      directionsDisplay.setDirections({
         geocoded_waypoints: waypoints,
         routes: routes,
         request: response["request"]
      });

      callback(routeInfo);
   });
}



















