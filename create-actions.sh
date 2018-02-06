source .env

# Retrieve credentials from file
NCL_USERNAME=`jq .natural_language_classifier[].credentials.username credentials.json`;
NCL_PASSWORD=`jq .natural_language_classifier[].credentials.password credentials.json`;
DISCOVERY_USERNAME=`jq .discovery[].credentials.username credentials.json`;
DISCOVERY_PASSWORD=`jq .discovery[].credentials.password credentials.json`;

# Create Actions
echo "Creating Cloud Function Actions..."
export PACKAGE="suggestions"
bx wsk package create suggestions
bx wsk action create $PACKAGE/suggestion-provider actions/suggestion-provider.js --web true

echo "Setting default parameters..."
bx wsk action update $PACKAGE/suggestion-provider \
  --param conversationUsername $NCL_USERNAME \
  --param conversationPassword $NCL_PASSWORD \
  --param discoveryUsername $DISCOVERY_USERNAME \
  --param discoveryPassword $DISCOVERY_PASSWORD \
  --param environment_id $ENVIRONMENT_ID \
  --param collection_id $COLLECTION_ID
  #  --param workspace_id $WORKSPACE_ID \

echo 'Creating Action Sequence...'
bx wsk action create $PACKAGE/suggestion-provider-sequence --sequence $PACKAGE/suggestion-provider --web true

echo "Retrieving Action URL..."
API_URL=`bx wsk action get $PACKAGE/suggestion-provider-sequence --url | sed -n '2p'`;
API_URL+=".json"

# Write API Url to .env file
head -n 4 .env | cat >> .env_tmp; mv .env_tmp .env
echo "REACT_APP_API_URL=$API_URL" >> .env
