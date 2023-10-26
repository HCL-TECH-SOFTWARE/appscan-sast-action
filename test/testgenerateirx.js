import client from '../src/client.js';

client.generateIrx()
.then(() => {
    console.log("Done")
})
.catch((error) => {
    console.log(error)
})
