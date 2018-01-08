import urllib.request
import json

api_keys = json.loads("\n".join((open("api_keys.json", "r").readlines())))
print(api_keys)

# use origin and set a radius of desired distance to find locations within radius (cannot exceed radius for total distance)
# use intersections and locations (stores/buildings/etc.)
# 	distance matrix can give distances from multiple origins to multiple destinations
#	geocoding converts address into coordinates

# 1. get starting location (treat as start and end for now)
# 2. get desired total distance
# 3. find locations in radius (intersections and notable locations)

starting_location = input("What is the starting (and ending) location's address? ")
desired_distance = float(input("What is the run distance (in miles)? "))
dist_miles = 1609.34 * desired_distance

print("Starting from %s and running for %s miles" % (starting_location, desired_distance))


starting_address = starting_location.replace(" ", "+");
url = "https://maps.googleapis.com/maps/api/geocode/json?address=%s&key=%s" % (starting_address, api_keys["geocoding"])
content = urllib.request.urlopen(url).read().decode('UTF-8')
content_dict = json.loads(content)
coordinates = content_dict["results"][0]["geometry"]["location"]
print("latitude: " + str(coordinates["lat"]) + ", longitude: " + str(coordinates["lng"]))

# performs places request
url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=%s,%s&radius=%f&types=food&key=%s" % (str(coordinates["lat"]), str(coordinates["lng"]), dist_miles, api_keys["places"])
print("url :" + url)
content = urllib.request.urlopen(url).read().decode('UTF-8')
content_dict = json.loads(content)
print(content_dict)