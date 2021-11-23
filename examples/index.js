require('isomorphic-fetch');
const createReport = require('../dist/docgen.cjs').default;
const fs = require('fs');

const template = fs.readFileSync(process.argv[2]);
const data = {
    "allFilms": {
        "films": [
          {
            "title": "<p><p style='text-align: right'>right align text</p><p><strong>Revenge of the Sith<strong></p><p> <u>underlined text</u> <ul><li>one</li><li>two</li></ul></p>",
            "releaseDate": "2005-05-19"
          },
          {
            "title": "<p style='text-align:right'>New Hope</p>",
            "releaseDate": "2005-05-19"
          }
        ]
    }
};

const all  = {
    data: {
        bullets: "<ul>\n<li>one</li>\n<li>two</li>\n<li>three</li>\n</ul>\n",
        simpletext: "This is simnple text",
        bold: "<p>This is for bold: <strong>This is bold text</strong></p>",
        italic: '<em>This is italic text</em>',
        underline: "<u>This text is underlined</u>",
        left: "<p style='text-align:left'>This text is left aligned</p>",
        right: 'This text is right aligned',
        center: 'This text is center aligned',
        hyperlink: '<p><a href="https://ddg.gg/ " target="_self"><strong><em>Duck Duck go</em></strong></a></p>\n'
    }
}
createReport({
    template,
    data: all,
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