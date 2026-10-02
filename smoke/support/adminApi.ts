import type { APIRequestContext } from '@playwright/test'

/**
 * The few admin-only API calls the test-stage smoke test needs for its own setup and clean-up,
 * made with the API's machine-to-machine client.
 *
 * The account the suite signs up is a standard user, and standard users cannot create rooms. The
 * suite used to borrow whatever rooms demo-data had generated. Now it brings its own, so it works
 * in an environment with no demo data at all (mootmaker-release#64, mootmaker-api#95 rule 6).
 *
 * Test stage only. The production suite is read-only and never calls this.
 */

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set - see smoke/run.sh.`)
  return value
}

let cachedToken: Promise<string> | undefined

/**
 * Fetched once per run, not per call. Cognito bills every machine-to-machine token request, with no
 * free tier, and a token stays valid for hours - far longer than this suite takes.
 */
function accessToken(request: APIRequestContext): Promise<string> {
  cachedToken ??= fetchAccessToken(request).catch((error: unknown) => {
    cachedToken = undefined
    throw error
  })
  return cachedToken
}

async function fetchAccessToken(request: APIRequestContext): Promise<string> {
  const response = await request.post(requireEnv('M2M_TOKEN_URL'), {
    form: {
      grant_type: 'client_credentials',
      client_id: requireEnv('M2M_CLIENT_ID'),
      client_secret: requireEnv('M2M_CLIENT_SECRET'),
      scope: requireEnv('M2M_SCOPE'),
    },
  })
  if (!response.ok()) throw new Error(`Token request failed: ${response.status()} ${await response.text()}`)
  return ((await response.json()) as { access_token: string }).access_token
}

async function graphql<T>(request: APIRequestContext, query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await request.post(requireEnv('GRAPHQL_API_URL'), {
    headers: { Authorization: await accessToken(request), 'Content-Type': 'application/json' },
    data: { query, variables },
  })
  const body = (await response.json()) as { data?: T; errors?: { message: string }[] }
  if (body.errors?.length) throw new Error(`GraphQL request failed: ${JSON.stringify(body.errors)}`)
  return body.data as T
}

/** Creates a room and returns its id. */
export async function createRoom(request: APIRequestContext, name: string, capacity: number): Promise<string> {
  const data = await graphql<{ createRoom: { room: { id: string } | null; errors: string[] } }>(
    request,
    'mutation($room: RoomInput!) { createRoom(room: $room) { room { id } errors } }',
    { room: { name, capacity } },
  )
  if (!data.createRoom.room) throw new Error(`Room was rejected: ${data.createRoom.errors.join(', ')}`)
  return data.createRoom.room.id
}

/** Deletes a room. Fails if a meeting from today onward is still booked in it. */
export async function deleteRoom(request: APIRequestContext, id: string): Promise<void> {
  const data = await graphql<{ deleteRoom: { errors: string[] } }>(
    request,
    'mutation($id: ID!) { deleteRoom(id: $id) { errors } }',
    { id },
  )
  if (data.deleteRoom.errors.length) throw new Error(`Room deletion was rejected: ${data.deleteRoom.errors.join(', ')}`)
}
