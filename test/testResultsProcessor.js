import resultProcessor from '../src/resultProcessor.js';

let jsonString ='\
{\
  "Items": [\
    {\
      "Severity": "Informational",\
      "Count": 1\
    },\
    {\
      "Severity": "Low",\
      "Count": 1\
    },\
    {\
      "Severity": "Medium",\
      "Count": 28\
    },\
    {\
      "Severity": "High",\
      "Count": 93\
    },\
    {\
      "Severity": "Critical",\
      "Count": 1\
    }\
  ]\
}'

let responseJson = JSON.parse(jsonString);
resultProcessor.processResults(responseJson.Items)
.then((result)=> {
    console.log(result);
})
.catch((error) => {
    console.log(error);
})
