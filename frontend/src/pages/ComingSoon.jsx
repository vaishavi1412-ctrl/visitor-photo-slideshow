import { Link } from 'react-router-dom';

export default function ComingSoon({ title }) {
  return (
    <div className="card narrow" style={{ margin: '3rem auto' }}>
      <h1>{title}</h1>
      <p className="muted">This page is built in a later step.</p>
      <Link to="/" className="btn btn-secondary">
        Back to home
      </Link>
    </div>
  );
}