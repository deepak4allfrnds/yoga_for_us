export default function Footer({ outlets = [] }) {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <h3 className="serif">Yoga For Us</h3>
          <p>
            White-and-green studios for everyday practice. Come for the asana,
            stay for the breath.
          </p>
        </div>
        <div>
          <h3 className="serif">Studio hours</h3>
          {outlets.slice(0, 1).map((o) => (
            <p key={o.id}>
              {o.timings}
              <br />
              {o.phone}
            </p>
          ))}
        </div>
        <div>
          <h3 className="serif">All outlets</h3>
          {outlets.map((o) => (
            <p key={o.id}>
              <strong>{o.name}</strong>
              <br />
              {o.address}
              <br />
              {o.timings}
            </p>
          ))}
        </div>
      </div>
      <div className="container" style={{ marginTop: 28, opacity: 0.8 }}>
        © {new Date().getFullYear()} Yoga For Us
      </div>
    </footer>
  );
}
