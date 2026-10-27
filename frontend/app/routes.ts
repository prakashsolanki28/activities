import { type RouteConfig, index, layout, prefix, route } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),

  // Employee-facing
  route('a/:slug', 'routes/play/layout.tsx', [
    index('routes/play/entry.tsx'),
    route('play', 'routes/play/player.tsx'),
    route('result', 'routes/play/result.tsx'),
    route('leaderboard', 'routes/play/leaderboard.tsx'),
  ]),
  route('c/:code', 'routes/certificate.tsx'),

  // Live team games: projector display (public, read-only)
  route('g/:code', 'routes/game/display.tsx'),

  // Admin console
  ...prefix('admin', [
    route('login', 'routes/admin/login.tsx'),
    route('games/:id/print', 'routes/admin/game/print.tsx'),
    layout('routes/admin/layout.tsx', [
      index('routes/admin/home.tsx'),
      route('activities', 'routes/admin/activities.tsx'),
      route('activities/:id', 'routes/admin/activity/layout.tsx', [
        index('routes/admin/activity/builder.tsx'),
        route('settings', 'routes/admin/activity/settings.tsx'),
        route('publish', 'routes/admin/activity/publish.tsx'),
        route('responses', 'routes/admin/activity/responses.tsx'),
        route('insights', 'routes/admin/activity/insights.tsx'),
      ]),
      route('games/:id', 'routes/admin/game/host.tsx'),
      route('games/:id/questions', 'routes/admin/game/questions.tsx'),
      route('admins', 'routes/admin/admins.tsx'),
    ]),
  ]),

  route('*', 'routes/not-found.tsx'),
] satisfies RouteConfig;
