import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';
import { Groq } from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3000;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('Server is running!');
});

app.post('/slack/actions', async (req, res) => {
  if (!req.body.payload) {
    return res.status(400).send('No payload provided');
  }

  const payload = JSON.parse(req.body.payload);

  if (payload.type === 'view_submission' && payload.view.callback_id === 'grammar_modal') {
    const userInput = payload.view.state.values.text_block.user_text_input.value;
    const correctedText = await checkGrammar(userInput);

    return res.json({
      response_action: 'update',
      view: {
        type: 'modal',
        title: {
          type: 'plain_text',
          text: 'Grammar Check Result'
        },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Original Text:*\n\`\`\`${userInput}\`\`\`\n*Corrected Text:*\n\`\`\`${correctedText}\`\`\``
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: 'Tip: Click and drag to select the text above, then right-click to copy it.'
              }
            ]
          }
        ]
      }
    });
  }

  if (payload.type === 'block_actions' && payload.actions[0].action_id === 'check_grammar_button') {
    const message = payload.message || payload.original_message;

    let messageText = '';

    if (message.text) {
      messageText = message.text;
    }
    else if (message.blocks) {
      message.blocks.forEach(block => {
        if (block.type === 'section' && block.text && block.text.text) {
          messageText += block.text.text + '\n';
        }
        if (block.type === 'rich_text') {
          block.elements.forEach(element => {
            if (element.type === 'rich_text_section') {
              element.elements.forEach(item => {
                if (item.type === 'text') {
                  messageText += item.text + '\n';
                }
              });
            }
          });
        }
      });
    }

    // Clean the text
    messageText = messageText
        .replace(/<@\w+>/g, '') // Remove user mentions
        .replace(/<#\w+\|\w+>/g, '') // Remove channel mentions
        .replace(/<https?:\/\/[^\|]+\|([^>]+)>/g, '$1') // Unfurl links
        .replace(/<[^>]+>/g, '') // Remove any other Slack formatting
        .trim();

    if (!messageText) {
      messageText = "No text found to check. Please type your message below.";
    }

    try {
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
                text: 'Review and edit the text'
              },
              element: {
                type: 'plain_text_input',
                action_id: 'user_text_input',
                initial_value: messageText,
                multiline: true
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
    } catch (error) {
      console.error('Error opening modal:', error.response?.data || error.message);
      return res.status(500).send('Error opening grammar check modal');
    }

    return res.status(200).send();
  }

  return res.status(400).send('Invalid action');
});

async function checkGrammar(text) {
  if (!text || text.trim().length === 0) {
    return "No text provided for grammar check.";
  }

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are an expert English grammar checker. Correct any grammar, spelling, or punctuation errors in the following text while preserving the original meaning and tone. Return only the corrected text without additional commentary or explanations.'
        },
        {
          role: 'user',
          content: `Please correct this text: ${text}`
        }
      ],
      model: 'llama3-70b-8192',
      temperature: 0.3,
      max_tokens: 2000
    });
    return completion.choices[0]?.message?.content || text;
  } catch (error) {
    console.error('Error checking grammar:', error);
    return text;
  }
}

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});