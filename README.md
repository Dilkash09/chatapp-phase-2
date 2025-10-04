Chat Application
System Overview
This is the project proposal that deals with a live chat application developed in text and video chat. It is built to allow safe and organized communication to be made across groups and channels, and has a permission trialed tier with three roles Super Admin, Group Admin, and ordinary User. The app is developed on MEAN (MongoDB, Express, Angular, Node.js) stack and is considering Socket.io, as a real-time messaging framework and Peer.js, as a peer-to-peer video communication technology.

Organization of Git Repository
This Git repository is structured in a way that enables the project to have an efficient workflow in development that is also collaborative. We are going to follow a Git Flow topology that incorporates:

main branch: Is the production ready code. Changes are only committed into this branch when a merge of develop has succeeded.

develop branch: The main consumed branch most recent new features. All feature branches not yet merged into develop are merged.

feature branches: New features (e.g. feature/user-auth, feature/group-management) are developed as being on their separate branches. This secludes alterations and eliminates wrangles.

Regular Updates: Development will be with regular, miniscule commits having comprehensible messages.

Mono-Repo Structure: The repository will be a mono-repo, in it there will be folders with the names client/ (Angular frontend) and server/ (Node.js backend) at the top level. This dichotomy maintains order and clarity to the two sides of the application.

The most relevant files that are not relevant to a project will be excluded using the .gitignore file where it will be assigned correctly to exclude non-essential folders like node_modules/ and environment-specific files.
Data Structures
Data models on the application are consistent between the client and the server so that communication and integrity of the data is ensured.

User
Represents an interviewee of a chat.

id: string

username: string (unique)

email: string

hashed on the server: string password:

roles: Array<string>[e.g. ['user'], ['user', 'group_admin'], ['super_admin']]

groups: GroupMembership[]

Group
A group of users that share the same set of channels.

id: string

name: string

description: string

createdBy: string (ID of a User who created it)

admins: string[] (User IDs Group Admins)

members: string[] (User ID of all members)

channels: string[] (IDs of channel in the group)

Channel
A chat Group in text and video chat that contains a subgroup.

id: string

name: string

groupId: string

createdBy: string (the User ID of the user who created it)

members: string[]

bannedUsers: string[]

Message
One chat line.

id: string

channelId: string

senderId: string

content: string

timestamp: Date
Angular Architecture
The Angular frontend takes the form of modular and code component based architecture to facilitate scalability and maintenance.

Components
Every component of a UI is contained within a component which adheres to the Single Responsibility Principle.

Module: Auth Module: LoginComponent, RegisterComponent.

Chat Module: ChatLayoutComponent, GroupListComponent, ChannelListComponent, ChatWindowComponent.

Admin : SuperAdminDashboardComponent, GroupAdminDashboardComponent.

Shared Module: Components, directives, and pipes that are re-used throughout the application.

Services
Business logic and data retrieving is encapsulated into services, making the components lean and specialized in presentation. We will have specific services AuthService, UserService, GroupService, ChannelService and a SocketService to deal with real-time communications.

Models
Interfaces on the client side (interfaces.ts) will be a copy of the corresponding ones on the server side to have type safety there.

Routes
It will implement the router of Angular to change view. Secret routes shall be guarded by Route Guards to allow or deny access to a particular route depending on the role of a user.

Routes
POST /api/register: Signs up a new chat user.

POST /api/login: sign a user in and returns a token.

GET: /api/users: Lists all users of the system.

PUT /users/:id/roles: Update roles of the user (Super Admin only).

GET /api/groups: Gets all groups that the authenticated user has access to.

POST /api/groups: Creates a group (Group Admin+).

DELETE /api/groups/:id (Group creator/Super Admin) Moves a group (Group creator/Super Admin).

GET /api/groups/:groupId/channels: Gives a list of channels in a group.

POST /api/groups/:groupId/channels: Adds a new channel in a group (Group Admin+).

api/channels/:channelId/messages (POST) Push a new message into a channel.

Client-Server Interaction flow
Authentication: Angulars LoginComponent posts to /api/login. The user authenticates with the server then the server generates a JWT and returns it. Client stores the JWT and provides it in other subsequent requests either through HTTP Interceptor or a service.

Data Updates: Once a component (e.g., GroupAdminDashboardComponent) must do a new item (e.g., a new group), it makes anHTTP request tothe Express API.

Server-Side Logic: The Express server intercepts the request, performs operations on the data and writes it back to the database server, MongoDB.

Real-time Sync: Whenever a successful update of the database occurs (e.g. some new message is written), the Socket.io module of the server sends out an event ('newMessage').

Client-Side Update:
 The ChatWindowComponent is updated to observe the event to the SocketService instance by the event name: newMessage. When it hears the event, it writes to its local state, again causing the template to re-render, to show the new message in real time.

Video Chat: Peer.js is used to setup a peer-to-peer video stream. The Node.js server serves as signaling server to communicate with each other peers, but real video data transmitted between the two users and it causes a reduction in server load.

Conclusion
The current documentation will serve as a strong basis to the subsequent development of the main features of the chat application. It presents both the client and server with a well-structured, modular and clear design with modularity ensuring the solution is robust and scalable as well as easy to support. Through this architecture and design we would be in a position to ensure that we are in a capacity to construct the necessary features necessary in Phase 1 in an efficient manner.
