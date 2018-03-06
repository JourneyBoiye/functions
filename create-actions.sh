source .env

# Retrieve credentials from file
NCL_USERNAME=`jq .natural_language_classifier[].credentials.username credentials.json`;
NCL_PASSWORD=`jq .natural_language_classifier[].credentials.password credentials.json`;
DISCOVERY_USERNAME=`jq .discovery[].credentials.username credentials.json`;
DISCOVERY_PASSWORD=`jq .discovery[].credentials.password credentials.json`;
CLOUDANT_USERNAME=`jq .cloudant[].username credentials.json`;
CLOUDANT_PASSWORD=`jq .cloudant[].password credentials.json`;
CLOUDANT_DB=`jq .cloudant[].db credentials.json`;

# Build
npm run build

# Create Actions
echo "Creating Cloud Function Actions..."
export PACKAGE="suggestions"
bx wsk package create suggestions
bx wsk action create $PACKAGE/suggestion-provider dist/bundle.js --web true --kind nodejs:8

echo "Setting default parameters..."
bx wsk action update $PACKAGE/suggestion-provider \
  --param nlcUsername $NCL_USERNAME \
  --param nlcPassword $NCL_PASSWORD \
  --param discoveryUsername $DISCOVERY_USERNAME \
  --param discoveryPassword $DISCOVERY_PASSWORD \
  --param environment_id $ENVIRONMENT_ID \
  --param collection_id $COLLECTION_ID \
  --param cloudantUsername $CLOUDANT_USERNAME \
  --param cloudantPassword $CLOUDANT_PASSWORD \
  --param cloudantDb $CLOUDANT_DB
  #  --param workspace_id $WORKSPACE_ID \

#echo 'Creating Action Sequence...'
#bx wsk action create $PACKAGE/suggestion-provider-sequence --sequence $PACKAGE/suggestion-provider --web true

echo "Retrieving Action URL..."
API_URL=`bx wsk action get $PACKAGE/suggestion-provider --url | sed -n '2p'`;
API_URL+=".json"

# Write API Url to .env file
head -n 4 .env | cat >> .env_tmp; mv .env_tmp .env
echo "REACT_APP_API_URL=$API_URL" >> .env
