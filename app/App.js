import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, useColorScheme, Dimensions } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { GiftedChat } from 'react-native-gifted-chat';
import { Charts } from 'react-native-charts-wrapper';
import OpenAI from 'openai';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { HumanMessage, SystemMessage } from 'langchain/schema';

const supabaseUrl = process.env.SUPABASE_URL || 'your-supabase-url';
const supabaseKey = process.env.SUPABASE_KEY || 'your-supabase-key';
const openaiApiKey = process.env.OPENAI_API_KEY || 'your-openai-api-key';

const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI({ apiKey: openaiApiKey });
const chatModel = new ChatOpenAI({ openAIApiKey: openaiApiKey });

export default function App() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? { background: '#000', text: '#fff' } : { background: '#fff', text: '#000' };
  const [messages, setMessages] = useState([]);
  const [data, setData] = useState([]);
  const [userId] = useState('test-user'); // Replace with auth

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: userData } = await supabase
      .from('user_data')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(30);
    setData(userData || []);
  };

  const onSend = async (newMessages = []) => {
    setMessages(previousMessages => GiftedChat.append(previousMessages, newMessages));
    const userMessage = newMessages[0].text;

    const chartData = {
      dataSets: [{
        values: data.map(d => ({ x: new Date(d.timestamp).getTime(), y: d.hrv || 0 })),
        label: 'HRV Trend',
        config: { color: '#ff0000' }
      }],
    };

    const messages = [
      new SystemMessage('You are a wellness coach. Suggest behaviors linked to data trends.'),
      new HumanMessage(`User data: ${JSON.stringify(data)}. Query: ${userMessage}`),
    ];

    const response = await chatModel.call(messages);
    setMessages(previousMessages => GiftedChat.append(previousMessages, {
      _id: Math.random(),
      text: response.content,
      createdAt: new Date(),
      user: { _id: 2, name: 'HealthGPT' },
    }));
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background }}>
      <Text style={{ color: theme.text, padding: 10 }}>Wellness Trends</Text>
      <Charts
        style={{ height: 200 }}
        data={chartData}
        type="LineChart"
        chartDescription={{ text: '' }}
      />
      <GiftedChat
        messages={messages}
        onSend={onSend}
        user={{ _id: 1 }}
      />
    </ScrollView>
  );
}