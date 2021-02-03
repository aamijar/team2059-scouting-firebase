/**
 * 
 * @author Anupam M.
 * @file This is the file that firebase uses to deploy cloud functions.
 * 
 */


const functions = require('firebase-functions');
const admin = require('firebase-admin');

const {PubSub} = require('@google-cloud/pubsub');

const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const Promise = require("bluebird");


//increase timeout to max limit of 9 minutes
const runtimeOpts = {
  timeoutSeconds: 540
};

const constants = require('./constants');

const user = constants.user;
const pass = constants.pass;

const baseURL = 'https://frc-api.firstinspires.org/v2.0/2021/';

const rootCollection = "2021_data"


//setup
admin.initializeApp();
const pubSubClient = new PubSub();

var regionalCallCount = 0;
var districtCallCount = 0;

exports.updateFirestore = functions.runWith(runtimeOpts).https.onRequest((request, response) => {
  
  /* CHAMPIONSHIP SEQUENCE WORKING */     // promise arr to 'let'
  let promiseArr = [];
  getChampionships().then((result) => {
    console.log(result);
    
    for(let i = 0; i < result.length; i ++){
      promiseArr.push(result[i].code);
    }
    
    return Promise.mapSeries(promiseArr, (item) => {
      return getChampionshipTeams(item).delay(3000);
    });

  }).then((allResult) => {
    console.log(allResult);
    
    return Promise.mapSeries(allResult, (item) => {
      return getChampionshipAvatars(item).delay(3000);
    })

  }).then((finalResult) => {
    console.log(finalResult);
    //return pubSubClient.topic('districtStart').publishJSON({"district": "start"});
    return pubSubClient.topic('regionalStart').publishJSON({"regional": "start"});
    //return pubSubClient.topic('districtOverflow').publishJSON([{"name": "myname", "number": 0}, {"name": "myname2", "number": 2}]);
    
  }).then((pubsubMessage) => {
    console.log(pubsubMessage);
    return response.send(pubsubMessage);
  })
  .catch((error) => {
    console.log(error);
    response.send(error);
  });

  
});

/* REGIONAL SEQUENCE WORKING */

exports.fetchRegionals = functions.runWith(runtimeOpts).pubsub.topic('regionalStart').onPublish((message) => {
  console.log('be', regionalCallCount);
  if(regionalCallCount === 1){
    console.log('yes', regionalCallCount);
    return null;
  }
  regionalCallCount ++;
  console.log('after', regionalCallCount);
  return getRegionals().then((result) => {
    console.log(result);
    
    let promiseArr = [];
    
    // change i start value here, for testing a few regionals only
    for(let i = 0; i < result.length; i ++){
      promiseArr.push(result[i].code);
    }
    
    return Promise.mapSeries(promiseArr, (item) => {
      return getRegionalTeams(item).delay(3000);
    });

  }).then((allResult) => {
    console.log(allResult);
    
    return Promise.mapSeries(allResult, (item) => {
      return getRegionalAvatars(item).delay(3000);
    })

  }).then((finalResult) => {
    console.log(finalResult);
    return pubSubClient.topic('districtStart').publishJSON({"district": "start"});
  })
  .catch((error) => {
    console.log(error);
  });
});

/* DISTRICT SEQUENCE WORKING */

exports.fetchDistricts = functions.runWith(runtimeOpts).pubsub.topic('districtStart').onPublish((message) => {
  console.log('be', districtCallCount);
  if(districtCallCount === 1){
    console.log('yes', districtCallCount);
    return null;
  }
  districtCallCount ++;
  console.log('after', districtCallCount);
  var overflowArr = null;
  return getDistricts().then((result) => {
    console.log(result);

    let promiseArr = [];
    for(let i = 0; i < result.length; i ++){
      promiseArr.push(result[i].code);
    }
    return Promise.mapSeries(promiseArr, (item) => {
      return getDistrictEvents(item).delay(3000);
    });

  }).then((allResult) => {
    console.log(allResult);

    var tempArr = [];

    for(let i= 0; i < allResult.length; i ++){
      for(let j=0; j < allResult[i].events.length; j ++){
        var tmpObject = new Object();
        tmpObject.districtCode = allResult[i].districtCode;
        tmpObject.eventCode = allResult[i].events[j].code;
        tempArr.push(tmpObject);
      }
    }
    
    var index = tempArr.length;
    if(tempArr.length > 70){
      index = Math.floor(tempArr.length/2);
      overflowArr = tempArr.slice(index);
    }
    

    // change first param to tempArr.slice(x) for testing a few events only
    return Promise.mapSeries(tempArr.slice(0, index), (item) => {
      return getDistrictTeams(item).delay(3000);
    });
  }).then((nextResult) => {
    return Promise.mapSeries(nextResult, (item) => {
      return getDistrictAvatars(item).delay(3000);
    });
  }).then((finalResult) => {
    console.log(finalResult);

    if(overflowArr !== null){
      return pubSubClient.topic('districtOverflow').publishJSON(overflowArr);
    }
    return null;
  })
  .catch((error) => {
    console.log(error);
  })
});


exports.fetchDistrictsOverflow = functions.runWith(runtimeOpts).pubsub.topic('districtOverflow').onPublish((message) => {
  
  return Promise.mapSeries(message.json, (item) => {
    return getDistrictTeams(item).delay(3000);
  }).then((result) => {
    return Promise.mapSeries(result, (item) => {
      return getDistrictAvatars(item).delay(3000);
    })
  }).then((finalResut) => {
    return console.log(finalResut);
  }).catch((error) => {
    console.log(error);
  });
  
});







function getChampionships(){
  return new Promise((resolve, reject) => {
    var request = new XMLHttpRequest();

    request.open('GET', baseURL + 'events'
    , true, user, pass);

    request.withCredentials = true;
    request.setRequestHeader('Accept', 'application/json');

    request.onload = function () {
      
      if (this.status === 200) {
        
        var output = JSON.parse(this.responseText);
        
        var championshipArrayJSON = output.Events;
        
        var championshipArray = [];

        for(var i = 0; i < championshipArrayJSON.length; i ++){
            if(championshipArrayJSON[i].divisionCode !== null){
                var championshipObject = new Object();
                championshipObject.name = championshipArrayJSON[i].name;
                championshipObject.code = championshipArrayJSON[i].code;
                championshipArray.push(championshipObject);
            }   
        }

        admin.firestore().collection(rootCollection).doc('championships').set({"championshipCodes": championshipArray});
        
        resolve(championshipArray);
        
      }
      else{
        reject(new Error('whoops'));
      }

    };
    request.onerror = function(){

      reject(new Error('whoops'));
    };

    request.send();
  
  });
  

}


function getChampionshipTeams(code){
  return new Promise((resolve, reject) => {
    var query = baseURL + "teams?eventCode=" + code;

    var request = new XMLHttpRequest();


    request.open('GET', query, true, user, pass);

    request.withCredentials = true;
    request.setRequestHeader('Accept', 'application/json');


    request.onload = function () {
      if (this.readyState === 4) {
        console.log('Status:', this.status);
        // console.log('Headers:', this.getAllResponseHeaders());
        // console.log('Body:', this.responseText);

        var output = JSON.parse(this.responseText);
        var teamsArrayJSON = output.teams;   
        var teamsArray = [];

        
        var tempChampionshipObject = new Object();
        tempChampionshipObject.code = code;

        for(var i = 0; i < teamsArrayJSON.length; i ++){
            var teamObject = new Object();
            teamObject.name = teamsArrayJSON[i].nameShort;
            teamObject.number = teamsArrayJSON[i].teamNumber;
            teamsArray.push(teamObject);
        }
        tempChampionshipObject.teamNames = teamsArray;
        
        //return object with code and current teams array... will be updated with avatars
        resolve(tempChampionshipObject);

      }
      else{
        reject(new Error('whoops'));
      }
    };

    request.send();

  });
  
}


function getChampionshipAvatars(tempChampionshipObject){
  return new Promise((resolve, reject) => {
    var code = tempChampionshipObject.code;
    var teamNames = tempChampionshipObject.teamNames;
    
    var query = baseURL + "avatars?eventCode=" + code;

    var request = new XMLHttpRequest();

    



    request.open('GET', query, true, user, pass);

    request.withCredentials = true;
    request.setRequestHeader('Accept', 'application/json');


    request.onload = function () {
      if (this.readyState === 4) {
        console.log('Status:', this.status);
        
        var output = JSON.parse(this.responseText);
        var avatarArrayJSON = output.teams;


        for(let i = 0; i < avatarArrayJSON.length; i ++){
          for(let j =0; j < teamNames.length; j ++){
            if(avatarArrayJSON[i].teamNumber === teamNames[j].number){
              teamNames[j].avatar = avatarArrayJSON[i].encodedAvatar;
            }
          }
        }
        

        admin.firestore().collection(rootCollection).doc('championships').collection('teams').doc(code).set({"teams": teamNames});
        resolve(code + " > teams list fetched!");

      }
      else{
        reject(new Error('whoops'));
      }
    };

    request.send();

  });




}


function getRegionals(){
  return new Promise((resolve, reject) => {
    var request = new XMLHttpRequest();

  

    request.open('GET', baseURL + 'events'
    , true, user, pass);

    request.withCredentials = true;
    request.setRequestHeader('Accept', 'application/json');


    request.onload = function () {
      
      if (this.status === 200) {
        
        var output = JSON.parse(this.responseText);
        
        var regionalArrayJSON = output.Events;
        
        var regionalArray = [];

        for(let i = 0; i < regionalArrayJSON.length; i ++){
            if(regionalArrayJSON[i].type === "Regional"){
                var regionalObject = new Object();
                regionalObject.name = regionalArrayJSON[i].name;
                regionalObject.code = regionalArrayJSON[i].code;
                regionalArray.push(regionalObject);
            }   
        }

        admin.firestore().collection(rootCollection).doc('regionals').set({"regionalCodes": regionalArray});
        

        resolve(regionalArray);
        
      }
      else{
        reject(new Error('whoops'));
      }

    };
    request.onerror = function(){

      reject(new Error('whoops'));
    };

    request.send();
  
  });  
}

function getRegionalTeams(code){
  return new Promise((resolve, reject) => {
    var query = baseURL + "teams?eventCode=" + code;

    var request = new XMLHttpRequest();


    request.open('GET', query, true, user, pass);

    request.withCredentials = true;
    request.setRequestHeader('Accept', 'application/json');


    request.onload = function () {
      if (this.readyState === 4) {
        console.log('Status:', this.status, code);
        
        var output = JSON.parse(this.responseText);
        var teamsArrayJSON = output.teams;   
        var teamsArray = [];

        
        var tempRegionalObject = new Object();
        tempRegionalObject.code = code;

        for(var i = 0; i < teamsArrayJSON.length; i ++){
            var teamObject = new Object();
            teamObject.name = teamsArrayJSON[i].nameShort;
            teamObject.number = teamsArrayJSON[i].teamNumber;
            teamsArray.push(teamObject);
        }
        tempRegionalObject.teamNames = teamsArray;

        resolve(tempRegionalObject);

      }
      else{
        reject(new Error('whoops'));
      }
    };

    request.send();

  });
}

function getRegionalAvatars(tempRegionalObject){
  return new Promise((resolve, reject) => {
    var code = tempRegionalObject.code;
    var teamNames = tempRegionalObject.teamNames;
    
    var query = baseURL + "avatars?eventCode=" + code;

    var request = new XMLHttpRequest();

    request.open('GET', query, true, user, pass);

    request.withCredentials = true;
    request.setRequestHeader('Accept', 'application/json');


    request.onload = function () {
      if (this.readyState === 4) {
        console.log('Status:', this.status, code);
        
        var output = JSON.parse(this.responseText);
        var avatarArrayJSON = output.teams;


        for(let i = 0; i < avatarArrayJSON.length; i ++){
          for(let j =0; j < teamNames.length; j ++){
            if(avatarArrayJSON[i].teamNumber === teamNames[j].number){
              teamNames[j].avatar = avatarArrayJSON[i].encodedAvatar;
            }
          }
        }
        

        admin.firestore().collection(rootCollection).doc('regionals').collection('teams').doc(code).set({"teams": teamNames});
        resolve(code + " > teams list fetched!");

      }
      else{
        reject(new Error('whoops'));
      }
    };

    request.send();

  });

}


// {districtCode: "", eventCode: "", teamNames: [{name: "", number: 0, avatar: ""}]}

function getDistricts(){
  return new Promise((resolve, reject) => {
    var request = new XMLHttpRequest();

  

    request.open('GET', baseURL + 'districts'
    , true, user, pass);

    request.withCredentials = true;
    request.setRequestHeader('Accept', 'application/json');


    request.onload = function () {
      
      if (this.status === 200) {
        
        var output = JSON.parse(this.responseText);
        
        var districtArrayJSON = output.districts;
        
        var districtArray = [];

        for(var i = 0; i < districtArrayJSON.length; i ++){
            var districtObject = new Object();
            districtObject.name = districtArrayJSON[i].name;
            districtObject.code = districtArrayJSON[i].code;
            districtArray.push(districtObject);
        }

        
        
        admin.firestore().collection(rootCollection).doc('districts').set({"districtCodes": districtArray});
        

        resolve(districtArray);
        
      }
      else{
        reject(new Error('whoops'));
      }

    };
    request.onerror = function(){

      reject(new Error('whoops'));
    };

    request.send();
  
  });    


}

function getDistrictEvents(districtCode){
  return new Promise((resolve, reject) => {
    var request = new XMLHttpRequest();

    
    
    request.open('GET', baseURL + 'events?districtCode=' + districtCode 
    , true, user, pass);

    request.withCredentials = true;
    request.setRequestHeader('Accept', 'application/json');


    request.onload = function () {
      
      if (this.status === 200) {
        
        console.log("status:", this.status, districtCode);
        var output = JSON.parse(this.responseText);
        
        var districtEventsJSON = output.Events;
        
        var eventsArray = [];

        var tempEventObject = new Object();
        tempEventObject.districtCode = districtCode;

        for(var i = 0; i < districtEventsJSON.length; i ++){
            var districtEventObject = new Object();
            districtEventObject.name = districtEventsJSON[i].name;
            districtEventObject.code = districtEventsJSON[i].code;
            eventsArray.push(districtEventObject);
        }
        tempEventObject.events = eventsArray;
        
        
        admin.firestore().collection(rootCollection).doc('districts').collection('district events').doc(districtCode).set({"district event": eventsArray})
        
        
        resolve(tempEventObject);
        
      }
      else{
        reject(new Error('whoops'));
      }

    };
    request.onerror = function(){

      reject(new Error('whoops'));
    };

    request.send();
  
  });    

}



function getDistrictTeams(eventObject){
  return new Promise((resolve, reject) => {
    var districtCode = eventObject.districtCode;
    var eventCode = eventObject.eventCode;
    
    var request = new XMLHttpRequest();

    
    
    request.open('GET', baseURL + 'teams?eventCode=' + eventCode 
    , true, user, pass);

    request.withCredentials = true;
    request.setRequestHeader('Accept', 'application/json');


    request.onload = function () {
      
      if (this.status === 200) {
        
        console.log("status:", this.status, districtCode, eventCode);
        var output = JSON.parse(this.responseText);
        
        var districtTeamsJSON = output.teams;
        
        var teamsArray = [];

        for(var i = 0; i < districtTeamsJSON.length; i ++){
          var teamObject = new Object(); 
          teamObject.name = districtTeamsJSON[i].nameShort;
          teamObject.number = districtTeamsJSON[i].teamNumber;
          teamsArray.push(teamObject)
        }
        
        eventObject.teamNames = teamsArray;
        
        resolve(eventObject);
        
      }
      else{
        reject(new Error('whoops'));
      }

    };
    request.onerror = function(){
      reject(new Error('whoops'));
    };

    request.send();
  
  });    

}

function getDistrictAvatars(eventObject){
  return new Promise((resolve, reject) => {
    var districtCode = eventObject.districtCode;
    var eventCode = eventObject.eventCode;
    var teamNames = eventObject.teamNames;
    
    var query = baseURL + "avatars?eventCode=" + eventCode;

    var request = new XMLHttpRequest();

    
    request.open('GET', query, true, user, pass);

    request.withCredentials = true;
    request.setRequestHeader('Accept', 'application/json');


    request.onload = function () {
      if (this.readyState === 4) {
        console.log('Status:', this.status, districtCode, eventCode);
        
        var output = JSON.parse(this.responseText);
        var avatarArrayJSON = output.teams;


        for(let i = 0; i < avatarArrayJSON.length; i ++){
          for(let j =0; j < teamNames.length; j ++){
            if(avatarArrayJSON[i].teamNumber === teamNames[j].number){
              teamNames[j].avatar = avatarArrayJSON[i].encodedAvatar;
            }
          }
        }
        

        admin.firestore().collection(rootCollection).doc('districts').collection('district events').doc(districtCode).collection('teams').doc(eventCode).set({"teams": teamNames})
        resolve(eventCode + " " + districtCode + " > team list fetched!");

      }
      else{
        reject(new Error('whoops'));
      }
    };

    request.send();

  });

}



/* test function to try promises */
function simpleTest(){
  return new Promise(((resolve, reject) => {

    console.log('simple test')
    setTimeout(() => resolve("done"), 1000);
    
  }))
}

/* test function for getting data from firestore */
async function getData(){
  const regionalRef = admin.firestore().collection(rootCollection).doc('regionals');
  const doc = await regionalRef.get();
  if (!doc.exists) {
    console.log('No such document!');
  } else {
    console.log('Document data:', doc.data());
  }
}

/* EXAMPLE SCHEDULED FUNCTION */

// exports.helloScheduled = functions.pubsub.schedule('every 1 minutes').onRun((context) => {
//   //console.log(context);
//   console.log('this function is run every 1 minute!');
//   return null;
// });




