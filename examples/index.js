require('isomorphic-fetch');
const createReport = require('../dist/docgen.cjs').default;
const fs = require('fs');

const template = fs.readFileSync(process.argv[2]);
const data = {
    "allFilms": {
        "films": [
          {
            "title": "<strong>Revenge of the Sith</strong>",
            "releaseDate": "2005-05-19"
          }
        ]
    }
};
createReport({
    template,
    data,
    /*
    data: (query) =>
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
        */
}).then(
    rendered => fs.writeFileSync(
        process.argv.length > 3 ? process.argv[3] : null,
        rendered
    ))
    .catch(console.log);