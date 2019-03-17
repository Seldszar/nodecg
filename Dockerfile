FROM node:8

# Ensure base directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Copy the package manifest
COPY package.json /usr/src/app/

# Install Bower globally
RUN npm install -g bower

# Install dependencies
RUN npm install --production && npm cache clean --force
RUN bower install --allow-root && bower cache clean

# Copy the rest
COPY . /usr/src/app

# Ensure NodeCG directories
RUN mkdir bundles cfg db logs

# Define volumes
VOLUME /usr/src/app/bundles /usr/src/app/cfg /usr/src/app/db /usr/src/app/logs

# Expose default port
EXPOSE 9090

# Start NodeCG
CMD ["npm", "start"]
