import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';

const app = express();
const port = 3000;
const SLACK_BOT_TOKEN = 'xoxb-8703104575057-8695379819459-9nteN7phb3ORUqdUGtGvanum';

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('Server is running!');
});

app.post('/slack/actions', async (req, res) => {
  if (!req.body.payload) return res.status(400).send();

  const payload = JSON.parse(req.body.payload);

  // Modal submission handler
  if (payload.type === 'view_submission' && payload.view.callback_id === 'grammar_modal') {
    const userInput = payload.view.state.values.text_block.user_text_input.value;
    const correctedText = await checkGrammar(userInput);

    return res.json({
      response_action: 'errors',
      errors: {
        text_block: `✅ ${correctedText}`
      }
    });
  }

  // Button click handler (to open modal)
  if (payload.type === 'block_actions' && payload.actions[0].action_id === 'check_grammar_button') {
    await axios.post('https://slack.com/api/views.open', {
      trigger_id: payload.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'grammar_modal',
        title: {
          type: 'plain_text',
          text: 'Grammar Check'
        },
        submit: {
          type: 'plain_text',
          text: 'Check'
        },
        close: {
          type: 'plain_text',
          text: 'Cancel'
        },
        blocks: [
          {
            type: 'input',
            block_id: 'text_block',
            label: {
              type: 'plain_text',
              text: 'Enter your message'
            },
            element: {
              type: 'plain_text_input',
              action_id: 'user_text_input'
            }
          }
        ]
      }
    }, {
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    return res.status(200).send();
  }

  res.status(400).send('Invalid action');
});

async function checkGrammar(text) {
  // You can integrate grammar-check APIs here
  return `Grammar-corrected: ${text}`;
}

async function sendMessageWithButton(channelId) {
  const messagePayload = {
    channel: channelId,
    text: 'Click the button to check grammar!',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Click the button to check grammar.'
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Check Grammar'
          },
          action_id: 'check_grammar_button'
        }
      }
    ]
  };

  await axios.post('https://slack.com/api/chat.postMessage', messagePayload, {
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
}

async function sendMessageToAllChannels() {
  const channelsResponse = await axios.get('https://slack.com/api/conversations.list', {
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`
    }
  });

  const channels = channelsResponse.data.channels;

  for (const channel of channels) {
    if (channel.is_channel && !channel.is_archived && channel.is_member) {
      await sendMessageWithButton(channel.id);
    }
  }
}

app.listen(port, () => {
  sendMessageToAllChannels();
});
