import saclientutil from '../src/saclientutil.js';
import * as constants from '../src/constants.js'

saclientutil.downloadClient()
.then(() => {
    console.log(constants.GENERATING_IRX);
})
.catch((error) => {
    console.log(error)
})