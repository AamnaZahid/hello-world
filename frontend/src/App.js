import React, { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  const fetchHello = async () => {
    setStatus("loading");
    setError(null);
    try {
      const response = await axios.get("/api/hello", {
        timeout: 8000,
        responseType: "text",
        transformResponse: [(data) => data],
      });
      setMessage(response.data);
      setStatus("success");
    } catch (err) {
      setError(err.message || "Request failed");
      setStatus("error");
    }
  };

  useEffect(() => {
    fetchHello();
  }, []);

  return (
    <div className="app">
      <div className="card">
        <h1 className="title">React Frontend on K3s</h1>
        <p className="subtitle">
          A full-stack Hello World running on a Kubernetes (K3s) cluster
        </p>

        <div className="panel">
          <div className="panel-header">
            <span className={`dot dot-${status}`} />
            <span className="panel-title">Backend Response</span>
            <span className="endpoint">GET /api/hello</span>
          </div>

          <div className="panel-body">
            {status === "loading" && (
              <span className="loading">Contacting backend-service…</span>
            )}
            {status === "success" && (
              <span className="message">{message}</span>
            )}
            {status === "error" && (
              <span className="error">Error: {error}</span>
            )}
          </div>
        </div>

        <button className="btn" onClick={fetchHello} disabled={status === "loading"}>
          {status === "loading" ? "Loading…" : "Refresh"}
        </button>

        <footer className="footer">
          <span>React</span>
          <span className="sep">•</span>
          <span>Spring Boot</span>
          <span className="sep">•</span>
          <span>Docker</span>
          <span className="sep">•</span>
          <span>K3s</span>
        </footer>
      </div>
    </div>
  );
}

export default App;
