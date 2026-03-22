import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Users, MessageCircle, Share, GitBranch, Clock, Code, Video, Mic, MicOff, VideoOff } from "lucide-react";
import { Link } from "wouter";

interface CollaborationSession {
  id: string;
  projectName: string;
  participants: Participant[];
  status: 'active' | 'paused' | 'ended';
  startTime: string;
  engine: string;
  isVoiceCall: boolean;
  isVideoCall: boolean;
}

interface Participant {
  id: string;
  name: string;
  avatar: string;
  role: 'owner' | 'collaborator' | 'viewer';
  status: 'online' | 'away' | 'busy';
  lastSeen: string;
}

interface Message {
  id: string;
  userId: string;
  username: string;
  content: string;
  timestamp: string;
  type: 'text' | 'code' | 'system';
}

interface CodeChange {
  id: string;
  userId: string;
  username: string;
  file: string;
  description: string;
  timestamp: string;
  type: 'add' | 'modify' | 'delete';
}

export default function CollaborationHub() {
  const [sessions, setSessions] = useState<CollaborationSession[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [codeChanges, setCodeChanges] = useState<CodeChange[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);

  useEffect(() => {
    // Initialize collaboration data
    const sessionData: CollaborationSession[] = [
      {
        id: '1',
        projectName: 'Pixel Adventure RPG',
        participants: [
          {
            id: '1',
            name: 'Alex Chen',
            avatar: '/api/placeholder/40/40',
            role: 'owner',
            status: 'online',
            lastSeen: 'now'
          },
          {
            id: '2',
            name: 'Sarah Kim',
            avatar: '/api/placeholder/40/40',
            role: 'collaborator',
            status: 'online',
            lastSeen: 'now'
          },
          {
            id: '3',
            name: 'Mike Rodriguez',
            avatar: '/api/placeholder/40/40',
            role: 'collaborator',
            status: 'away',
            lastSeen: '5 minutes ago'
          }
        ],
        status: 'active',
        startTime: '2024-01-16 14:30',
        engine: 'GDevelop',
        isVoiceCall: true,
        isVideoCall: false
      },
      {
        id: '2',
        projectName: 'Space Shooter 3D',
        participants: [
          {
            id: '4',
            name: 'Emma Wilson',
            avatar: '/api/placeholder/40/40',
            role: 'owner',
            status: 'online',
            lastSeen: 'now'
          },
          {
            id: '5',
            name: 'David Park',
            avatar: '/api/placeholder/40/40',
            role: 'viewer',
            status: 'online',
            lastSeen: 'now'
          }
        ],
        status: 'active',
        startTime: '2024-01-16 15:45',
        engine: 'Buildbox',
        isVoiceCall: false,
        isVideoCall: false
      }
    ];

    setSessions(sessionData);

    // Initialize messages
    const messageData: Message[] = [
      {
        id: '1',
        userId: '1',
        username: 'Alex Chen',
        content: 'Just updated the player movement script. Can everyone test it?',
        timestamp: '14:35',
        type: 'text'
      },
      {
        id: '2',
        userId: '2',
        username: 'Sarah Kim',
        content: 'The jump feels much better now! Good work.',
        timestamp: '14:36',
        type: 'text'
      },
      {
        id: '3',
        userId: '1',
        username: 'Alex Chen',
        content: 'function updatePlayer() {\n  player.x += velocity.x;\n  player.y += velocity.y;\n}',
        timestamp: '14:37',
        type: 'code'
      },
      {
        id: '4',
        userId: 'system',
        username: 'System',
        content: 'Mike Rodriguez joined the session',
        timestamp: '14:40',
        type: 'system'
      }
    ];

    setMessages(messageData);

    // Initialize code changes
    const codeChangeData: CodeChange[] = [
      {
        id: '1',
        userId: '1',
        username: 'Alex Chen',
        file: 'player.js',
        description: 'Updated movement physics',
        timestamp: '14:35',
        type: 'modify'
      },
      {
        id: '2',
        userId: '2',
        username: 'Sarah Kim',
        file: 'enemy.js',
        description: 'Added new enemy type',
        timestamp: '14:20',
        type: 'add'
      },
      {
        id: '3',
        userId: '1',
        username: 'Alex Chen',
        file: 'config.json',
        description: 'Updated game settings',
        timestamp: '14:15',
        type: 'modify'
      }
    ];

    setCodeChanges(codeChangeData);
  }, []);

  const sendMessage = () => {
    if (currentMessage.trim()) {
      const newMessage: Message = {
        id: Date.now().toString(),
        userId: 'current-user',
        username: 'You',
        content: currentMessage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'text'
      };
      setMessages([...messages, newMessage]);
      setCurrentMessage('');
    }
  };

  const joinSession = (sessionId: string) => {
    console.log(`Joining session ${sessionId}`);
  };

  const startVoiceCall = () => {
    setIsVoiceEnabled(!isVoiceEnabled);
  };

  const startVideoCall = () => {
    setIsVideoEnabled(!isVideoEnabled);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/engine-launcher">
            <Button variant="outline" className="border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-black">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Engine Launcher
            </Button>
          </Link>
          
          <div className="text-center">
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400">
              Collaboration Hub
            </h1>
            <p className="text-gray-400">Real-time collaborative development</p>
          </div>
          
          <Button className="bg-orange-500 hover:bg-orange-600 text-white">
            <Share className="w-4 h-4 mr-2" />
            Invite Collaborators
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Active Sessions */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Users className="w-5 h-5 mr-2 text-orange-400" />
                  Active Sessions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sessions.map((session) => (
                    <div key={session.id} className="p-4 bg-gray-700/30 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-white">{session.projectName}</h3>
                          <div className="flex items-center space-x-2 text-sm text-gray-400">
                            <span>Engine: {session.engine}</span>
                            <span>•</span>
                            <span>Started: {session.startTime}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={
                            session.status === 'active' ? 'bg-green-500' :
                            session.status === 'paused' ? 'bg-orange-500' :
                            'bg-red-500'
                          }>
                            {session.status}
                          </Badge>
                          <Button 
                            size="sm" 
                            className="bg-orange-500 hover:bg-orange-600 text-white"
                            onClick={() => joinSession(session.id)}
                          >
                            Join
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex -space-x-2">
                          {session.participants.map((participant) => (
                            <div key={participant.id} className="relative">
                              <Avatar className="w-8 h-8 border-2 border-gray-900">
                                <AvatarImage src={participant.avatar} />
                                <AvatarFallback>{participant.name.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-gray-900 ${
                                participant.status === 'online' ? 'bg-green-500' :
                                participant.status === 'away' ? 'bg-orange-500' :
                                'bg-red-500'
                              }`}></div>
                            </div>
                          ))}
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {session.isVoiceCall && (
                            <Badge variant="outline" className="border-green-500 text-green-500">
                              <Mic className="w-3 h-3 mr-1" />
                              Voice
                            </Badge>
                          )}
                          {session.isVideoCall && (
                            <Badge variant="outline" className="border-blue-500 text-blue-500">
                              <Video className="w-3 h-3 mr-1" />
                              Video
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Changes */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <GitBranch className="w-5 h-5 mr-2 text-orange-400" />
                  Recent Changes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {codeChanges.map((change) => (
                    <div key={change.id} className="flex items-center space-x-3 p-3 bg-gray-700/30 rounded-lg">
                      <div className={`w-3 h-3 rounded-full ${
                        change.type === 'add' ? 'bg-green-500' :
                        change.type === 'modify' ? 'bg-orange-500' :
                        'bg-red-500'
                      }`}></div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-white font-medium">{change.file}</span>
                          <span className="text-sm text-gray-400">{change.timestamp}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-300">{change.description}</span>
                          <span className="text-sm text-gray-400">by {change.username}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chat Panel */}
          <div className="space-y-6">
            {/* Communication Controls */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white text-sm">Communication</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={isVoiceEnabled ? "default" : "outline"}
                    size="sm"
                    onClick={startVoiceCall}
                    className={isVoiceEnabled ? "bg-green-500 hover:bg-green-600" : "border-gray-600"}
                  >
                    {isVoiceEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant={isVideoEnabled ? "default" : "outline"}
                    size="sm"
                    onClick={startVideoCall}
                    className={isVideoEnabled ? "bg-blue-500 hover:bg-blue-600" : "border-gray-600"}
                  >
                    {isVideoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Chat */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <MessageCircle className="w-5 h-5 mr-2 text-orange-400" />
                  Team Chat
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Messages */}
                  <div className="h-64 overflow-y-auto space-y-3">
                    {messages.map((message) => (
                      <div key={message.id} className={`${
                        message.type === 'system' ? 'text-center' : ''
                      }`}>
                        {message.type === 'system' ? (
                          <div className="text-sm text-gray-400 italic">
                            {message.content}
                          </div>
                        ) : (
                          <div className="flex space-x-2">
                            <Avatar className="w-6 h-6">
                              <AvatarFallback className="text-xs">
                                {message.username.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-white">
                                  {message.username}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {message.timestamp}
                                </span>
                              </div>
                              <div className={`text-sm mt-1 ${
                                message.type === 'code' 
                                  ? 'bg-gray-900 p-2 rounded font-mono text-green-400' 
                                  : 'text-gray-300'
                              }`}>
                                {message.content}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {/* Message Input */}
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Type a message..."
                      value={currentMessage}
                      onChange={(e) => setCurrentMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                    <Button 
                      size="sm" 
                      onClick={sendMessage}
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      Send
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Participants */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white text-sm">Participants</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sessions[0]?.participants.map((participant) => (
                    <div key={participant.id} className="flex items-center space-x-3">
                      <div className="relative">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={participant.avatar} />
                          <AvatarFallback>{participant.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-gray-900 ${
                          participant.status === 'online' ? 'bg-green-500' :
                          participant.status === 'away' ? 'bg-orange-500' :
                          'bg-red-500'
                        }`}></div>
                      </div>
                      <div className="flex-1">
                        <div className="text-white text-sm font-medium">{participant.name}</div>
                        <div className="text-xs text-gray-400">{participant.role}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}