import Botkit from 'botkit'
import http from 'http'
import querystring from 'querystring'

if (!process.env.providerKey || !process.env.serviceID || !process.env.token) {
  console.log('Error: Specify providerKey serviceID and token in environment');
  process.exit(1);
}

let controller = Botkit.slackbot()
let bot = controller.spawn({
  token: process.env.token
})

bot.startRTM((err, bot, payload) => {
  if (err) {
    throw new Error('Could not connect to Slack');
  }
})

controller.hears(['che'], 'direct_message,direct_mention,mention', (bot, message) => {

  bot.api.reactions.add({
    timestamp: message.ts,
    channel: message.channel,
    name: 'robot_face',
  }, function(err, res) {
    if (err) {
      bot.botkit.log('Failed to add emoji reaction :(', err);
    }
  });


  controller.storage.users.get(message.user, function(err, user) {
    if (user && user.name) {
      bot.reply(message, 'Hello ' + user.name + '!!');
    } else {
      bot.reply(message, 'Hello.');
    }
  });
});

controller.hears(['show'], 'direct_message,direct_mention,mention', function(bot, message) {
  let options = {
    hostname: 'multitenant-admin.3scale.net.dev',
    port: 3000,
    //path: '/stats/services/6/usage.json',
    method: 'GET',
    agent: false,
    path: `/stats/services/${process.env.serviceID}/usage.json?provider_key=${process.env.providerKey}&metric_name=hits&since=2016-06-07&until=2016-06-09&granularity=day&skip_change=true`
  };

  const POINT_INTERVALS = { hour: 3600 * 1000, day: 24 * 3600 * 1000, month: null }

  http.get(options, (res) => {
    /*console.log('statusCode: ', res.statusCode);
    console.log('headers: ', res.headers);*/
    res.setEncoding('utf8');

    res.on('data', (d) => {
      d = JSON.parse(d)
      // le hc shit
      let highchartsConfig = {
        yAxis: {
          min: 0,
          title: {
            text: 'Hits'
          }
        },
        xAxis: {
          type: 'datetime'
        },
        plotOptions: {
          pointInterval: POINT_INTERVALS[d.period.granularity],
          pointIntervalUnit: d.period.granularity,
          pointStart: Date.parse(d.period.since)
        },
        series: [{
          data: d.values
        }]
      }

      let postData = querystring.stringify({
        options: JSON.stringify(highchartsConfig),
        filename: 'le_plot',
        type: 'image/png',
        async: true
      });

      var options = {
        hostname: 'export.highcharts.com',
        path: '/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': postData.length
        }
      };

      console.log('options', options)
      console.log('postData', postData)

      let postReq = http.request(options, (res) => {
        console.log(`STATUS: ${res.statusCode}`);
        console.log(`HEADERS: ${JSON.stringify(res.headers)}`);

        res.setEncoding('utf8');
        
        res.on('data', (chunk) => {
          console.log(`BODY: ${chunk}`);
          let url = `http://export.highcharts.com/${chunk}`
          bot.reply(message, JSON.stringify(url))
        });

      })

      // post the data
      postReq.write(postData);
      postReq.end();


      bot.reply(message, JSON.stringify(d))
      //process.stdout.write(d);

    });
  })

  .on('error', (e) => {
    console.error(e);
  });
});


