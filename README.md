## AI Image Generator - Setup & Installation Guide
A full-stack AI image generation application with Next.js frontend and Spring Boot backend.


## Prerequisites

- Node.js (v18 or higher)
- Java (JDK 17 or higher)
- Maven (for Spring Boot)
- Python (v3.8 or higher) - for AI models
- Git



## Backend Setup (Spring Boot)

```bash
cd ai-backend
mvn clean install
mvn spring-boot:run
```

Backend will start on http://localhost:8080



## Frontend Setup (next.js)

IN NEW TERMINAL
```bash
cd ../frontend
npm install
npm run dev
```

Frontend will start on http://localhost:3000



## Stable Diffusion Download and Setup

IN NEW TERMINAL
```bash
git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui.git
cd stable-diffusion-webui
set COMMANDLINE_ARGS=--api
webui-user.bat
```

Stable Diffusion will start on http://localhost:7860



## TripoSR Download and Setup

IN NEW TERMINAL
```bash
git clone https://github.com/VAST-AI-Research/TripoSR.git
cd TripoSR
pip install -r requirements.txt
python api_server.py
```

TripoSR will start on http://localhost:5000
