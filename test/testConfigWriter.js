import configWriter from "../src/configWriter.js";

let files = ['file1', 'file2', 'file3'];
configWriter.write(files)
.then(() => {
    console.log('Config file generated successfully');
})
.catch((error) => {
    console.error('Error generating config file:', error);
});
