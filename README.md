# Puzzle Together

Puzzle Together is a collaborative jigsaw puzzle web application. This project includes a Node.js server, static frontend assets, and configuration for Docker and Kubernetes deployment.

## Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher recommended)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- [Docker](https://www.docker.com/) (optional, for containerized deployment)
- [Kubernetes](https://kubernetes.io/) (optional, for cluster deployment)

## Installation & Local Development

1. **Clone the repository:**
   ```sh
   git clone https://github.com/matst80/puzzle-together.git
   cd puzzle-together
   ```

2. **Install dependencies:**
   ```sh
   npm install
   ```

3. **Start the server:**
   ```sh
   npm start
   ```
   The app will be available at [http://localhost:3000](http://localhost:3000) by default.

## Building the Project

No build step is required for basic usage. The static files in `src/` and `public/` are served directly by the Node.js server.

## Docker Deployment

1. **Build the Docker image:**
   ```sh
   docker build -t puzzle-together .
   ```

2. **Run the Docker container:**
   ```sh
   docker run -p 3000:3000 puzzle-together
   ```
   The app will be available at [http://localhost:3000](http://localhost:3000).

## Kubernetes Deployment

1. **Build and push the Docker image to your registry** (update the image name as needed):
   ```sh
   docker build -t <your-dockerhub-username>/puzzle-together:latest .
   docker push <your-dockerhub-username>/puzzle-together:latest
   ```

2. **Update the `k8s-deployment.yaml` file** with your image name if necessary.

3. **Apply the Kubernetes deployment:**
   ```sh
   kubectl apply -f k8s-deployment.yaml
   ```

4. **Access the app:**
   - Use `kubectl get services` to find the external IP or port.

## Nginx Configuration

- The `nginx.conf` file is provided for advanced reverse proxy or static file serving setups. Adjust as needed for your environment.

## License

MIT
