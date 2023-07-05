const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const mongoose = require('mongoose');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/public', express.static(__dirname + '/public'));

main().catch(err => console.log(err));

async function main() {
  await mongoose.connect(process.env.DB);

  const querySchema = new mongoose.Schema({
    searchQuery: String,
    timeSearched: String,
  });
  const Queries = mongoose.model('Queries', querySchema);

  app.route('/')
    .get(function(req, res) {
      res.sendFile(process.cwd() + '/views/index.html');
    });
  app.route('/recent/')
    .get(async function(req, res) {
      console.log('GET /Recent/')
      const response = await Queries.find()
        .sort({ timeSearched: -1 })
        .select({ __v: 0 })
      console.log(response)
      return res.send(response)
    });

  app.route('/query/:_searchItem')
    .get(async function(req, res) {
      console.log('GET /query/')
      let searchItem = req.params._searchItem
      let queryObj = req.query
      // https://developers.google.com/custom-search/v1/reference/rest/v1/cse/list
      // https://www.raymondcamden.com/2020/03/22/implementing-google-custom-search-engines-json-api-in-the-jamstack
      let key = process.env.googleKey
      let cx = process.env.searchEngineID
      let googleQuery = 'https://customsearch.googleapis.com/customsearch/v1'
      googleQuery += `?cx=${cx}`
      googleQuery += `&q=${searchItem}`
      googleQuery += `&key=${key}`
      googleQuery += queryObj.size ? `&imgSize=${queryObj.size}` : ''
      googleQuery += `&start=${queryObj.page}`
      googleQuery += `&searchType=image`

      const response = await fetch(googleQuery);
      let data = await response.json();
      data = data.items
      // save query log into DB
      let newSearchDate = getMyDateString() // "September 24th 2021, 6:31:05 am"
      const newQuery = new Queries({ searchQuery: searchItem, timeSearched: newSearchDate });
      await newQuery.save();

      const images = [] // compile data into images array
      compileData()
      return res.json({ images: images })

      function compileData() {
        data.forEach(x => {
          let obj = {}
          obj.type = x.fileFormat
          obj.width = x.image.width
          obj.height = x.image.height
          obj.size = x.image.byteSize
          obj.url = x.link
          obj.thumbnail = {
            url: x.image.thumbnailLink,
            width: x.image.thumbnailWidth,
            height: x.image.thumbnailHeight
          }
          obj.description = x.snippet
          obj.parentPage = x.image.contextLink
          images.push(obj)
        })
      }
      function getMyDateString() {
        // "September 24th 2021, 6:31:05 am"
        let dateNow = new Date()
        let m = dateNow.toLocaleString("default", { month: "long" });
        let d = dateNow.getUTCDate()
        d = d + (31 == d || 21 == d || 1 == d ? "st" : 22 == d || 2 == d ? "nd" : 23 == d || 3 == d ? "rd" : "th")
        let y = dateNow.getUTCFullYear()
        let t = dateNow.toLocaleTimeString()
        let returnStr = `${m} ${d} ${y}, ${t}`
        // console.log(returnStr)
        return returnStr
      }

    });

  app.listen(3000, () => {
    console.log('server started');
  });
}
