let jsonString = '[{"Severity": "Informational","Count": 0},{"Severity": "Low","Count": 0 },{"Severity": "Medium","Count": 1},{"Severity": "High", "Count": 0}, { "Severity": "Critical", "Count": 0 }]'
let json = JSON.parse(jsonString);

let output = '';
json.forEach(element => {
    output += element.Severity + ' = ' + element.Count + '\n';
});

console.log(output);