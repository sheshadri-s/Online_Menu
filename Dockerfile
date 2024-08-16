# Stage 1: Build the React app
FROM node:14 as build

# Set working directory for frontend
WORKDIR /app/client

# Copy client files and install dependencies
COPY client/package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

COPY client/ ./
RUN npm run build

# Stage 2: Set up Node.js backend
FROM node:14

# Set working directory for backend
WORKDIR /app

# Copy backend package.json and install dependencies
COPY server/package*.json ./
RUN npm install

# Copy the backend code
COPY server/ ./

# Copy the built React app from the build stage to the backend's public directory
COPY --from=build /app/client/build ./public

# Expose the backend port
EXPOSE 5000

# Start the Node.js server
CMD ["npm", "start"]
