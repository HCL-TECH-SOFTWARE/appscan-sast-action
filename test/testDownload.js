const saclientutil = require('../src/saclientutil');

saclientutil.downloadClient()
.then(() => {
    console.log('downloaded!')
});
