import { imageSrc } from "../api";
import { isDirectVideo, youtubeId } from "../mediaUtils";

export default function MediaGrid({ items = [] }) {
  if (!items.length) {
    return <p className="muted">No yoga photos or videos yet.</p>;
  }

  return (
    <div className="grid-3 media-grid">
      {items.map((item) => {
        const yt = youtubeId(item.url);
        const fileVideo = item.media_type === "video" && !yt && isDirectVideo(item.url);
        return (
          <article className="card" key={item.id}>
            {item.media_type === "image" ? (
              <img className="cover media-cover" src={imageSrc(item.url)} alt={item.title} />
            ) : yt ? (
              <div className="media-frame">
                <iframe
                  title={item.title}
                  src={`https://www.youtube.com/embed/${yt}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : fileVideo ? (
              <video className="media-cover" src={imageSrc(item.url)} controls playsInline />
            ) : (
              <div className="media-cover media-placeholder">Video</div>
            )}
            <div className="card-body">
              <h3 className="serif" style={{ fontSize: 24, margin: "0 0 8px" }}>
                {item.title}
              </h3>
              {item.caption ? <p className="muted">{item.caption}</p> : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
