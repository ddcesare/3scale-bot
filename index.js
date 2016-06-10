import Botkit from 'botkit'
import http from 'http'
import querystring from 'querystring'
import moment from 'moment'

if (!process.env.providerKey || !process.env.serviceID || !process.env.token) {
  console.log('Error: Specify providerKey serviceID and token in environment');
  process.exit(1);
}

let controller = Botkit.slackbot();
let bot = controller.spawn({
  token: process.env.token
});

bot.startRTM((err, bot, payload) => {
  if (err) {
    throw new Error('Could not connect to Slack');
  }
});

controller.hears(['che'], 'direct_message,direct_mention,mention', (bot, message) => {

  bot.api.reactions.add({
    timestamp: message.ts,
    channel: message.channel,
    name: 'robot_face'
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

controller.hears(['show me the usage of (.*) from (.*) until (.*) per (.*)', 'show me the recent usage of (.*)', 'show me the recent usage'], 'direct_message,direct_mention,mention', function(bot, message) {
  let [metric, since, until, granularity] = ['hits', moment.utc().subtract(24, 'hours').format(), moment.utc().format(), 'hour'];

  if (message.match.length === 5) {
    console.log('5');
    [metric, since, until, granularity] = message.match.shift();
  }
  else if (message.match.length === 2) {
    console.log('2');
    [metric, since, until, granularity] = [message.match[1], moment.utc().subtract(24, 'hours').format(), moment.utc().format(), 'hour'];
  }

  let options = {
    hostname: 'multitenant-admin.3scale.net.dev',
    port: 3000,
    method: 'GET',
    agent: false,
    path: `/stats/services/${process.env.serviceID}/usage.json?provider_key=${process.env.providerKey}&metric_name=${metric}&since=${since}&until=${until}&granularity=${granularity}&skip_change=true`
  };

  const POINT_INTERVALS = { hour: 3600 * 1000, day: 24 * 3600 * 1000, month: null };

  http.get(options, (res) => {
    res.setEncoding('utf8');

    res.on('data', (d) => {
      d = JSON.parse(d);
      // le hc shit
      let highchartsConfig = {
        title: {
          text: `Usage of ${d.metric.name}`
        },
        yAxis: {
          min: 0,
          title: {
            text: d.name
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
          name: d.metric.name,
          data: d.values
        }]
      };

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


      let postReq = http.request(options, (res) => {
        console.log(`STATUS: ${res.statusCode}`);
        console.log(`HEADERS: ${JSON.stringify(res.headers)}`);

        res.setEncoding('utf8');
        
        res.on('data', (chunk) => {
          let url = `http://export.highcharts.com/${chunk}`;
          bot.reply(message, {
            'text': `A total of ${d.total} for metric ${d.metric.name} from ${moment(d.period.since).format('L')} until ${moment(d.period.until).format('L')} per ${d.period.granularity}`,
            'attachments': [
              {
                'fallback': `Oops, graph not showing? Blame Highcharts! :D`,
                'title': `Usage of ${d.metric.name}`,
                'image_url': url
              }
              ]
        })
        });

      });

      // post the data
      postReq.write(postData);
      postReq.end();

    });
  })

  .on('error', (e) => {
    console.error(e);
  });
});


