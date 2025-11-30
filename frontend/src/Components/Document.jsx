import React, { useState, useEffect } from "react";

export default function AdminDocuments() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [docs, setDocs] = useState([]);

  const token = localStorage.getItem("token"); // your auth token

  // Fetch all documents on load
  useEffect(() => {
    fetch("https://connectwithaaditiyamg2.onrender.com/api/document/search?q=.", {
      method: "GET"
    })
      .then(res => res.json())
      .then(data => setDocs(data))
      .catch(err => console.log(err));
  }, []);

  // Upload function
  const uploadFile = async () => {
    if (!file) return alert("Choose a file");

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("https://connectwithaaditiyamg2.onrender.com/api/admin/document/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData
    });

    const data = await res.json();
    setMessage(data.message || data.error);

    // Refresh list
    fetch("https://connectwithaaditiyamg2.onrender.com/api/document/search?q=.")
      .then(res => res.json())
      .then(data => setDocs(data));
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Admin Document Upload</h2>

      <div style={styles.uploadBox}>
        <input 
          type="file" 
          onChange={(e) => setFile(e.target.files[0])}
          style={styles.fileInput}
        />

        <button onClick={uploadFile} style={styles.uploadBtn}>
          Upload
        </button>

        {message && <p style={styles.msg}>{message}</p>}
      </div>

      <h3 style={styles.listHeading}>Uploaded Files</h3>

      <div style={styles.listBox}>
        {docs.length === 0 && <p>No files found</p>}

        {docs.map((d) => (
          <div key={d.id} style={styles.item}>
            <p style={styles.filename}>{d.originalName}</p>

           <button 
  style={styles.downloadBtn}
  onClick={async () => {
    const res = await fetch(`https://connectwithaaditiyamg2.onrender.com/api/download/${d.id}`);
    const data = await res.json();
    window.open(data.downloadUrl, "_blank");
  }}
>
  Open
</button>
<button
      style={styles.deleteBtn}
      onClick={async () => {
        await fetch(`https://connectwithaaditiyamg2.onrender.com/api/admin/document/${d.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        });

        // refresh list
        fetch("https://connectwithaaditiyamg2.onrender.com/api/document/search?q=.")
          .then(res => res.json())
          .then(data => setDocs(data));
      }}
    >
      Delete
    </button>

          </div>
        ))}
      </div>
    </div>
  );
}


/* INTERNAL CSS */
const styles = {
  container: {
    width: "600px",
    margin: "40px auto",
    fontFamily: "Arial, sans-serif"
  },
  heading: {
    textAlign: "center",
    fontSize: "26px",
    marginBottom: "20px"
  },
  uploadBox: {
    padding: "20px",
    background: "#f7f7f7",
    borderRadius: "8px",
    textAlign: "center",
    marginBottom: "30px"
  },
  fileInput: {
    marginBottom: "10px"
  },
  deleteBtn: {
  padding: "6px 12px",
  background: "red",
  color: "#fff",
  border: "none",
  borderRadius: "5px",
  cursor: "pointer"
}
,
  uploadBtn: {
    padding: "10px 20px",
    background: "#007bff",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    borderRadius: "5px",
    marginTop: "10px"
  },
  msg: {
    marginTop: "10px",
    color: "green"
  },
  listHeading: {
    fontSize: "22px",
    marginBottom: "10px"
  },
  listBox: {
    background: "#fafafa",
    padding: "15px",
    borderRadius: "8px"
  },
  item: {
    padding: "10px",
    marginBottom: "10px",
    borderBottom: "1px solid #ddd",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  filename: {
    fontSize: "16px"
  },
  downloadBtn: {
    padding: "6px 12px",
    background: "green",
    color: "#fff",
    textDecoration: "none",
    borderRadius: "5px"
  }
};
