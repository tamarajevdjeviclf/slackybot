import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';

const app = express();
const port = 3000;

//Middleware za parsiranje JSON tela
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

//Slack bot token (dobija se prilikom kreiranja aplikacije u Slack-u)
const SLACK_BOT_TOKEN = 'xoxb-8703104575057-8695379819459-9nteN7phb3ORUqdUGtGvanum';
app.get('/', (req, res) => {
    res.send('Server je pokrenut!');
  });

//Pritiskom na dugme se ovde dolazi, ali kroz req mi ne stigne poruka koju sam unela
app.post('/slack/actions', async (req, res) => {
  
  const payload = JSON.parse(req.body.payload);
  console.log('tamara' + JSON.stringify(req.body));

  if (payload.actions[0].action_id === 'check_grammar_button') {
    console.log('Dugme pritisnuto!');

    const originalText = payload.text;

    console.log('Originalni tekst:', originalText);
    const correctedText = await checkGrammar(originalText);

    await axios.post('https://slack.com/api/chat.postMessage', {
      channel: payload.channel.id,
      text: `Ispravljena poruka: ${correctedText}`,
    }, {
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
    
    res.status(200).send('Ok');
  } else {
    res.status(400).send('Invalid action');
  }
});

async function checkGrammar(text) {
    //ovde dodati slanje zahteva ka nekom AI alatu
    return `Ispravljena gramatika: ${text}`;
}

async function sendMessageWithButton(channelId) {
  const messagePayload = {
    channel: channelId,
    text: 'Kliknite dugme da biste proverili gramatiku!',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Kliknite na dugme da proverite gramatiku.'
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Proveri gramatiku'
          },
          action_id: 'check_grammar_button'
        }
      }
    ]
  };

  try {
    const response = await axios.post('https://slack.com/api/chat.postMessage', messagePayload, {
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json; charset=utf-8'
      }
    });

    console.log('Poruka poslata u kanal:', channelId);
  } catch (error) {
    console.error('Greška pri slanju poruke:', error);
  }
}

async function sendMessageToAllChannels() {
  try {
    const channelsResponse = await axios.get('https://slack.com/api/conversations.list', {
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`
      }
    });

    if (!channelsResponse.data.ok) {
      console.error('Greška pri dobijanju kanala:', channelsResponse.data.error);
      return;
    }

    const channels = channelsResponse.data.channels;

    // Ovde dodajem bota u sve kanale - mozda ovo nije neophodno
    for (const channel of channels) {
      if (channel.is_channel) {
        await sendMessageWithButton(channel.id, '');
      }
    }
  } catch (error) {
    console.error('Greška pri slanju poruka u sve kanale:', error);
  }
}
async function addBotToChannels() {
    try {
      const channelsResponse = await axios.get('https://slack.com/api/conversations.list', {
        headers: {
          'Authorization': `Bearer ${SLACK_BOT_TOKEN}`
        }
      });
  
      if (!channelsResponse.data.ok) {
        console.error('Greška pri dobijanju kanala:', channelsResponse.data.error);
        return;
      }
  
      const channels = channelsResponse.data.channels;
  
      // Prolazimo kroz sve kanale i dodajemo bota
      for (const channel of channels) {
        if (channel.is_channel) {
          console.log(`Dodajem bota u kanal: ${channel.id}`);
          
          await axios.post('https://slack.com/api/conversations.join', {
            channel: channel.id
          }, {
            headers: {
              'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
              'Content-Type': 'application/json; charset=utf-8'
            }
          });
        }
      }
    } catch (error) {
      console.error('Greška pri dodavanju bota u kanale:', error);
    }
  }
  
  addBotToChannels();
  
sendMessageToAllChannels();

app.listen(port, () => {
  console.log(`Server je pokrenut na http://localhost:${port}`);
});
