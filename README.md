# Helpdesk Project

A modern Helpdesk application with a React frontend and a Node.js/Express backend.

## Prerequisites

Before running the project, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [MySQL](https://www.mysql.com/)

## Environment Setup

Create a `.env` file in the `Backend` directory (if not already present) and configure your database credentials:

```env
DB_HOST=your_server_ip
DB_USER=your_user
DB_PASS=your_password
DB_NAME=deskflow
PORT=5000
```

## Installation

1. **Root Directory (Frontend)**
   ```bash
   npm install
   ```

2. **Backend Directory**
   ```bash
   cd Backend
   npm install
   ```

## Running the Application

You can run both the frontend and backend concurrently from the root directory:

```bash
npm run start-all
```

Alternatively, you can run them separately:

- **Frontend only**: `npm run dev`
- **Backend only**: `npm run server`

## Project Structure

- `src/`: React frontend source files.
- `Backend/`: Node.js/Express backend source files.
- `Backend/server.js`: Main backend entry point.
- `helpdesk.jsx`: Main application component.
- `db.json`: Local development database (if using json-server).
