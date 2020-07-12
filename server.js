'use strict'
const express = require('express');
const main = require('./main.js');
const app = express();
const port = 3007;
app.get('/', async (req, res) => {
    let dataStream = await main.start(req, res);
    // res.status(200).send(dataStream)
});

app.listen(port, () => {
    console.log(`App is running at port %d`, port);
    console.log("Press CTRL-C to stop\n");
});
