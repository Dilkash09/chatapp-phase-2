# chatapp-phase-2
Chat Application - Assignment Phase 2.
Name :Dilkash 
Family name : Wadhwani
Student number: s5391319



Github link: https://github.com/Dilkash09/chatapp-phase-2



Repository Overview
This is a repository of a real-time chat application built on top of assignment phase 2. The application is built on the MongoDB data storage, real time messaging using WebSockets, image sharing, and peer-to-peer video calling functionalities. The project has a well-defined frontend and backend with Angular and Node.js, respectively, in accordance with the latest trends in web development.

Organization and Usage of Git Repository.
The repository is organized in a systematic manner where Angular client is in the root directory and Server in a different server directory with Node.js server. In the development stage, we used a feature based branching, in which each significant feature (video chat, image upload, MongoDB integration, etc.) was created separately, and then integrated into the main branch. Frequent commits with explanatory messages were done according to traditional commit criteria, giving the history of features development and bug fixing the clarity. The working version of the application was always in the main branch, and experimental development went through a branch, and a pull request was used to review the code and then have it integrated.

Data Structures
Server-Side Data Models
The application is based on native MongoDB driver (no Mongoose) and well-constructed data structures. User model: this is where all user related data are stored such as user authentication, their group membership, peer id used in video calls and profile images path. Every user is identified by a UUID and MongoDB ObjectId to identify it flexibly. The Group model deals with chat communities that have several channels, where members can be tracked and metadata of the creation is available. Channels are present in groups and keep message history, and Messages support message content of both text and image format with user references and time stamps so they can display a complete chat history.

Client-Side Data Models
On the client-side (angular), TypeScript interfaces are corresponding to the server-side models with the necessary type safety. The User interface is in control of user state on the application and online state as well as peer connectivity. Group and Channel interfaces allow navigating the chat hierarchy in a structured manner, whereas Message interfaces provide the appearance of the chat history with the support of various types of content and user association to assign the messages correspondingly in the interface.

Client-Server Architecture
Responsibility Division
The architecture is based on a definite separation of concerns between the client and server elements. The server does all information persistence using MongoDB, user authentication using JWT tokens, real-time communication using Socket.IO, file storage using image uploads, and video signaling using PeerJS server. It offers a complete REST interface, which provides a response in the form of a JSON content on all data manipulations and is also used to serve static data.

The Angular client is user experience oriented and manages the interface, supports real time updates by connecting socket.io clients, capturing media to support video calls, managing application state using Angular services, and routing between various views in the client. This segregation will help the server control the integrity and security of data whereas the client will offer a responsive and interactive user interface.

API Routes and Socket Events
REST API Endpoints
The complete application operations are provided in the form of a full REST API by the server. Authentication endpoints (/api/auth/register, /api/auth/login) deal with the registration and the login of the users with the JWT tokens. User management routes facilitate profile updates and video calls video call peer ID upkeep, and profile image posting. Group and channel endpoints can be used to manage communities and message routes can be used to post text and image messages and paginate chat history.

Real-time Communication
Socket.IO provides the ability to have real-time functionality based on well-thought-out events. Customers send join-channel and leave-channel events as they browse chat rooms, and new-message messages are sent to all members of the channel. The server drives message-received events in order to broadcast messages live and to send user-joined/user-left messages to update all the users on the presence changes in the channel and provide an interactive and interactive live chat experience.

Angular Architecture
Component Structure
Angular application uses a feature-domain component architecture. The elements of authentication (LoginComponent, RegisterComponent) take care of user access that includes form validation and error message handling. The components of the chat interface give the primary application workspace with ChatComponent as the outermost component, ChannelListComponent as the navigation component, MessageListComponent as the chat history display component, and MessageInputComponent as the create new message component.

Video communication is maintained using special parts such as VideoChatComponent which is used to present the main call description and IncomingCallComponent which is used to manage the notification of call entries. UserProfileComponent has user management features in settings management and OnlineUsersComponent has user management features in indicators of presence.

Services and State Management.
Angular services have common functionality between components. AuthService is the authentication state and token management, ChatService is the real-time messaging by using Socket.IO, Peerservice is the WebRTC video call establishment and management, and Userservice is the user data and online status. These services preserve state of application and manage all communication between the server, so that the components remain dedicated to presentation logic.

Routing and Navigation
The application consists of Angular Router that has secure routes that require authentication. The route guards are used to block unauthorized access to chat features and lazy loading is used to optimize the performance of an application. The routing design offers a logical navigation system of authentication, primary chat interface, user profile, and video call sessions.

Client-Server Interaction Flow.
Both Authentication and Initialization.
When a user is accessing the application, the Angular router determines the state of authentication and redirects to the login, in case of need. After a successful authentication, a JWT token and user information are issued by the server and stored in the client to be used later. After that, the app starts the chat interface, loads the groups and channels of the user and connects Socket.IO and PeerJS connections to add real-time capabilities.

Real-time Chat Operations
The client sends socket events to enter the right rooms as the user passes through channels and loads previous messages when making calls to the REST API. In message sending, the client sends socket events to the server that continue the message to MongoDB and sends it to all members of the channel that are connected. The client synchronizes the message list automatically when new messages are sent by the client via socket events and this makes the chat experience smooth.

Handling Media and Video Call.
Profiles Image uploading is performed on multipart form data submissions to specific API endpoints, where the server will store the images in the filesystem and the paths in the database. In video calls, the PeerJS service is started in the case of user log in whereby it generates unique peer IDs which are synchronized with the server. On making of calls, the clients are connected via WebRTC directly with signaling being overseen by the peerJS server to facilitate low-latency peer-to-peer video communication.

State Synchronization
The application is in a consistent state with a combination of REST API and socket events to load the initial data and update the information in real time, respectively. Statuses of the users online, new messages, and call notifications are sent to the clients instantly, whereas less urgent information such as user profiles and group information are on-demand. This hybrid model would guarantee maximum performance and maintain consistency of data of all connected clients.

Testing Strategy
The application provides extensive testing on several levels. Tests on the server level: API route tests are done to verify various input conditions and error conditions. Unit tests verifying component behavior and service logic, and end-to-end tests verifying interactions between and among real users in the entire application workflow, are used in Angular. The reliability of this testing strategy allows developing further and with certainty.

Deployment and Execution
It is an easy to deploy application with environment-specific settings. The Node.js server will connect to MongoDB and offer API endpoints as well as serve the static files, whereas the Angular client will construct optimized production resources. The integration of PeerJS server allows making cross-network video calls, which is why the application can be used in the real life.



