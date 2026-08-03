import Body from 'react-muscle-highlighter';
import { colorForSlug } from '@gymlink/core/analytics';

const FRONT_SLUGS = [
  'chest', 'deltoids', 'biceps', 'forearm', 'abs', 'obliques',
  'quadriceps', 'adductors', 'tibialis', 'calves',
];

const BACK_SLUGS = [
  'trapezius', 'upper-back', 'lower-back', 'triceps', 'gluteal',
  'hamstring', 'calves',
];

function slugData(slugs, recovery) {
  return slugs.map((slug) => ({
    slug,
    color: colorForSlug(slug, recovery),
  }));
}

export default function BodyMap({ recovery, gender = 'male', scale = 0.85 }) {
  const g = gender === 'female' ? 'female' : 'male';
  const front = slugData(FRONT_SLUGS, recovery);
  const back = slugData(BACK_SLUGS, recovery);

  return (
    <div className="bm-wrap">
      <div className="bm-side">
        <p className="tiny muted bm-caption">앞</p>
        <div className="bm-view">
          <Body
            data={front}
            gender={g}
            side="front"
            scale={scale}
            border="#d1d5db"
            defaultFill="#e5e7eb"
          />
        </div>
      </div>
      <div className="bm-side">
        <p className="tiny muted bm-caption">뒤</p>
        <div className="bm-view">
          <Body
            data={back}
            gender={g}
            side="back"
            scale={scale}
            border="#d1d5db"
            defaultFill="#e5e7eb"
          />
        </div>
      </div>
    </div>
  );
}
