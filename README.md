# team2059-scouting-firebase
<a href="https://github.com/aamijar/team2059-scouting-firebase/actions"><img alt="GitHub Workflow Status" src="https://img.shields.io/github/workflow/status/aamijar/team2059-scouting-firebase/Node.js%20Testing?label=build&logo=github"></a>
<img alt="GitHub Workflow Status" src="https://img.shields.io/github/workflow/status/aamijar/team2059-scouting-firebase/Node.js%20Testing?color=ab5c2b&label=tests&logo=Mocha&logoColor=white">
<img alt="Node.js 10" src="https://img.shields.io/badge/Node.js-10-green?logo=Node.js&logoColor=green">
<img alt="Node.js 10" src="https://img.shields.io/badge/cloud%20functions-3.6.1-%23f29c07?logo=firebase">


Cloud functions that update firestore database with the latest FIRST® Robotics Competition events, teams, and avatars

Updating the database can take ~20 minutes because of the amount of requests (with a 3 second delay) that must be made to the FIRST® events API.

Therefore it is best to split up the task into several functions since each has a timeout of 9 minutes in google cloud. 
The first function is triggered by an http endpoint and the latter three are chained using pubsub messages.

It is highly advised to test functions using an emulator:

```
$ firebase emulators:start
```

In order to deploy to production environment:
```
$ firebase deploy
```

In order to update the database manually you can visit the url below. You must be authenticated using gcloud sdk otherwise you will recieve a forbidden error.
```
$ curl https://us-central1-team2059-scouting.cloudfunctions.net/updateFirestore -H 
"Authorization: bearer $(gcloud auth print-identity-token)"
```
