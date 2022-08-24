
function processResults(json) {
    return new Promise((resolve) => {
        let totalFindings = 0;
        let count = 0;
        let output = '';

        for(var i = 0; i < json.length; i++) {
            let element = json[i];
            totalFindings += element.Count;
            output += element.Severity + ' = ' + element.Count + '\n';
            if(++count === json.length) {
                output = 'Total issues = ' + totalFindings + '\n' + output;
                return resolve(output);
            }
        }
    });
}