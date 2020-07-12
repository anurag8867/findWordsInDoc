const fs = require("fs");
const axios = require("axios");
const path = require("path");
const async = require("async");
const es = require("event-stream");
let url = "http://jsonplaceholder.typicode.com/posts/1";
url = "https://norvig.com/big.txt";

let key = 'dict.1.1.20170610T055246Z.0f11bdc42e7b693a.eefbde961e10106a4efa7d852287caa49ecc68cf';
let lang = 'en-en';
let fileName = 'downloadedData.zip';

function rotateObject(obj) {
    let newObj = {};
    for (let key in obj) {
        newObj[obj[key]] = key;
    }
    return newObj;
}

async function chooseTopWordsObject(obj, length = 20) {
    let rotatedObj = rotateObject(obj)
    let respObj = {};
    let sortedArray = Object.keys(rotatedObj).sort();
    let topWords = sortedArray.slice(0, length);
    topWords.forEach((key) => {
        respObj[rotatedObj[key]] = key
    });
    return respObj;
}

function findWordsMeaning(respObj) {
    let words = Object.keys(respObj);
    let meanings = [];
    let parallelQuery = [];
    words.forEach((word) => {
        parallelQuery.push(
            function (callback) {
                fetchWordMeaning(word).then((resp) => {
                    if (resp && resp.data && resp.data.def && resp.data.def.length) {
                        meanings.push({
                            text: resp.data.def[0].text,
                            pos: resp.data.def[0].pos,
                            numberOfOccurences: respObj[word],
                            synonym: getSynonym(resp.data.def[0])
                        });
                    }
                    return callback(null, resp);
                })
                    .catch((err) => {
                        return callback(err, null);
                    })
            }
        )
    });
    return new Promise((resolve, reject) => {
        async.parallel(parallelQuery, (err, data) => {
            if (err) return reject(err);
            return resolve(meanings);
        });
    });
}

function getSynonym(data) {
    let synonyms = [];
    let tr = data && data.tr;
    if (tr && tr.length) {
        tr.forEach(function (value) {
            synonyms.push(value.text);
        })
    }
    return synonyms;
}

function fetchWordMeaning(text) {
    return axios.get(`https://dictionary.yandex.net/api/v1/dicservice.json/lookup?key=${key}&lang=${lang}&text=${text}`);
}

async function download(req, res) {
    return new Promise(async (resolve, reject) => {
        const [out, name] = ['./', `${fileName}`];
        const request = {
            url,
            responseType: 'stream'
        };

        try {
            const response = await axios(request);
            let writeStream;
            const file = path.resolve(out, name);
            writeStream = fs.createWriteStream(file);
            return response.data
                .pipe(writeStream)
                .on('finish', complete)
                .on('error', incomplete);



            function complete() {
                let wordObj = {};
                let resp = [];
                let readStream = fs.createReadStream(fileName);
                readStream
                    .pipe(es.split(' '))
                    .pipe(es.map((line) => {
                        if (line && line.length > 3) {
                            if (!wordObj[line.toLowerCase()]) {
                                wordObj[line.toLowerCase()] = 1;
                            } else {
                                wordObj[line.toLowerCase()] = wordObj[line.toLowerCase()] + 1;
                            }
                        }
                    }));

                readStream.on('end', async () => {
                    resp = await chooseTopWordsObject(wordObj);
                    let wordsMeaning = await findWordsMeaning(resp)
                    res.status(200).send(wordsMeaning.slice(0, 10));
                });

                readStream.on('error', (error) => {
                    console.log(error);
                });
            }

            function incomplete() {
                res.status(500).send({ status: 'incomplete', error: "an error occured" })
            }
        } catch (err) {
            reject(err);
        }
    });
};

module.exports = {
    start: download
}