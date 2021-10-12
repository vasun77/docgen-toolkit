require('isomorphic-fetch');
const createReport = require('../dist/docgen.cjs').default;
const fs = require('fs');

const template = fs.readFileSync(process.argv[2]);
const data = {
    "allFilms": {
        "films": [
          {
            "title": "A New Hope",
            "releaseDate": "1977-05-25"
          },
          {
            "title": "The Empire Strikes Back",
            "releaseDate": "1980-05-17"
          },
          {
            "title": "Return of the Jedi",
            "releaseDate": "1983-05-25"
          },
          {
            "title": "The Phantom Menace",
            "releaseDate": "1999-05-19"
          },
          {
            "title": "Attack of the Clones",
            "releaseDate": "2002-05-16"
          },
          {
            "title": "Revenge of the Sith",
            "releaseDate": "2005-05-19"
          }
        ]
    }
};
createReport({
    template,
    /*data,*/
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
}).then(
    rendered => fs.writeFileSync(
        process.argv.length > 3 ? process.argv[3] : null,
        rendered
    ))
    .catch(console.log);