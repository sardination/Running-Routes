import urllib.request
import json

api_keys = json.loads("\n".join((open("api_keys.json", "r").readlines())))

# use origin and set a radius of desired distance to find locations within radius (cannot exceed radius for total distance)
# use intersections and locations (stores/buildings/etc.)
# 	distance matrix can give distances from multiple origins to multiple destinations
#	geocoding converts address into coordinates

# 1. get starting location (treat as start and end for now)
# 2. get desired total distance
# 3. find locations in radius (intersections and notable locations)

starting_location = input("What is the starting (and ending) location's address? ")
desired_distance = float(input("What is the run distance (in miles)? "))
dist_miles = 1609.34 * desired_distance # convert from miles to meters for api parameter
half_dist = dist_miles / 2

print("Starting from %s and running for %s miles" % (starting_location, desired_distance))

# finds lat/long of start location
starting_address = starting_location.replace(" ", "+");
url = "https://maps.googleapis.com/maps/api/geocode/json?address=%s&key=%s" % (starting_address, api_keys["geocoding"])
content = urllib.request.urlopen(url).read().decode('UTF-8')
content_dict = json.loads(content)
start_coordinates = content_dict["results"][0]["geometry"]["location"]
print("latitude: " + str(start_coordinates["lat"]) + ", longitude: " + str(start_coordinates["lng"]))

# performs places request - finds all places in radius (NOTABLE PLACES - add to graph of points)
url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=%s,%s&rankby=prominence&radius=%f&key=%s" % (str(start_coordinates["lat"]), str(start_coordinates["lng"]), half_dist, api_keys["places"])
places_json = urllib.request.urlopen(url).read().decode('UTF-8')
places = json.loads(places_json)
#print(places)

# find distance between each location (distance matrix)
# origins and destinations are the same
num_places = len(places["results"])

print(str(num_places) + " places")
for i in range(num_places):
	print(places["results"][i]["name"] + " at (" + str(places["results"][i]["geometry"]["location"]["lat"]) + ", " + str(places["results"][i]["geometry"]["location"]["lng"]) + ") with place id " + places["results"][i]["place_id"])

locations = ""
for i in range(min(9, num_places)):
	print(i)
	place = places["results"][i]
	#lat = place["geometry"]["location"]["lat"]
	#lng = place["geometry"]["location"]["lng"]
	#locations = locations + lat + "," + lng + "|"
	place_id = place["place_id"]
	locations = locations + "place_id:" + place_id + "|"
locations = locations + str(start_coordinates["lat"]) + "," + str(start_coordinates["lng"])

url = "https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins=%s&destinations=%s&mode=walking&key=%s" % (locations, locations, api_keys["distance_matrix"])
print(url)
matrix_json = urllib.request.urlopen(url).read().decode('UTF-8')
matrix = json.loads(matrix_json)
print(matrix)

# find combinations of pairs to get full distance - get intersections / multiple ways to different locations
# get intersection in radius using OpenStreetMap? (data updated every week - need to pull and replace every week)
# display routes on a map and give highlights - start with just back and forth trips


