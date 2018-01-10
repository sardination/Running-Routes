// http://www.movable-type.co.uk/scripts/latlong.html
Number.prototype.toRad = function() {
   return this * Math.PI / 180;
}

Number.prototype.toDeg = function() {
   return this * 180 / Math.PI;
}

google.maps.LatLng.prototype.destinationPoint = function(brng, dist) {
   dist = dist / 6371;  
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
// init
var apiKeys = {};
var startAddress = "";
var startCoordinates = {};
var runLength = 0; // miles

$.getJSON("api_keys.json", function(data) {
   $.each(data, function(key, val) {
      apiKeys[key] = val;
   });
});

meters = function(miles) {
   return 1609.34 * miles;
}

updateMap = function() {
   startAddress = document.getElementById("address").value;
   startCoordinates = getCoordinates(startAddress);
   console.log(Object.keys(startCoordinates));
   runLength = document.getElementById("mileage").value;
   updateDrawing(startCoordinates);
}

getCoordinates = function(address) {
   var coordinates = {};
   // https://maps.googleapis.com/maps/api/geocode/json?address=%s&key=%s" % (starting_address, api_keys["geocoding"])
   $.get('https://maps.googleapis.com/maps/api/geocode/json', {
      address: address,
      key: apiKeys["geocoding"]
   }, function(data) {
      coordinates["lat"] = data["results"][0]["geometry"]["location"]["lat"];
      coordinates["lng"] = data["results"][0]["geometry"]["location"]["lng"];
   });

   console.log(Object.keys(coordinates));

   return coordinates;
}

updateDrawing = function(startCoordinates) {
   console.log(Object.keys(startCoordinates));
   var startPoint = new google.maps.LatLng(startCoordinates["lat"], startCoordinates["lng"]);   // Circle center
   var radius = meters(runLength) / 2;

   var mapOpt = { 
      mapTypeId: google.maps.MapTypeId.TERRAIN,
      center: startPoint,
      zoom: 10 // adjust zoom based on size of circle
   };

   var map = new google.maps.Map(document.getElementById("map"), mapOpt);

   // Draw the circle
   new google.maps.Circle({
      center: startPoint,
      radius: radius,
      fillColor: '#FF0000',
      fillOpacity: 0.2,
      map: map
   });

   // Show marker at circle center
   new google.maps.Marker({
      position: startPoint,
      map: map
   });

   // Show marker at destination point
   new google.maps.Marker({
      position: startPoint.destinationPoint(90, radius),
      icon: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
      map: map
   });
}