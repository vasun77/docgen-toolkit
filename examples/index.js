require('isomorphic-fetch');
const createReport = require('../dist/docgen.cjs').default;
const fs = require('fs');

const template = fs.readFileSync(process.argv[2]);

createReport({
    template,
    data: query =>
        fetch('http://swapi.apis.guru', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({query}),
        })
        .then(res => res.json())
        .then(res => res.data),
}).then(
    rendered => fs.writeFileSync(
        process.argv.length > 3 ? process.argv[3] : null,
        rendered
    ))
    .catch(console.log);