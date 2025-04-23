import { For, createEffect, createMemo, createSignal, onMount } from 'solid-js'
import { Dashjs } from '../players/dashjs/Dashjs.tsx'
import { Hlsjs } from '../players/hlsjs/Hlsjs.tsx'
import { Shaka } from '../players/shaka/Shaka.tsx'
import { VideojsShaka } from '../players/videojs-shaka/VideojsShaka.tsx'
import { Videojs } from '../players/videojs-vhs/Videojs.tsx'
import './PlayerGrid.css'

type Player = {
  id: string
  component: any
  instanceId?: string // unique instance id for each player
  label?: string // display name for the player
}

interface PlayerGridProps {
  playbackUrl?: string | null
  licenseUrl?: string | null
}

// constants for the grid layout
const COLUMNS = 3 // number of columns in the grid

// define available players
const availablePlayers: Player[] = [
  { id: 'videojs-vhs', component: Videojs, label: 'Video.js (VHS)' },
  { id: 'shaka', component: Shaka, label: 'Shaka Player' },
  { id: 'dashjs', component: Dashjs, label: 'dash.js' },
  { id: 'hlsjs', component: Hlsjs, label: 'hls.js' },
  { id: 'videojs-shaka', component: VideojsShaka, label: 'Video.js (Shaka)' },
]

// Create player instances once upfront
const playerInstances = availablePlayers.map((player) => ({
  ...player,
  instanceId: `instance-${player.id}`,
}))

export function PlayerGrid(props: PlayerGridProps) {
  // track which players are enabled
  const [enabledPlayers, setEnabledPlayers] = createSignal<
    Record<string, boolean>
  >({})

  // load enabled players from localstorage on mount
  onMount(() => {
    try {
      const stored = localStorage.getItem('enabledPlayers')
      if (stored) {
        setEnabledPlayers(JSON.parse(stored))
      } else {
        // default: all players enabled
        const defaultState = availablePlayers.reduce(
          (acc, player) => {
            acc[player.id] = true
            return acc
          },
          {} as Record<string, boolean>,
        )
        setEnabledPlayers(defaultState)
        localStorage.setItem('enabledPlayers', JSON.stringify(defaultState))
      }
    } catch (error) {
      console.error('Failed to load player preferences:', error)
    }
  })

  // save to localstorage when enabled players change
  createEffect(() => {
    localStorage.setItem('enabledPlayers', JSON.stringify(enabledPlayers()))
  })

  // toggle player enabled state
  const togglePlayer = (playerId: string, event?: MouseEvent) => {
    setEnabledPlayers((prev) => {
      // Check if Alt/Option key is pressed
      if (event?.altKey) {
        // Create a new state with all players disabled
        const newState: Record<string, boolean> = {}

        // Set all players to false
        for (const player of availablePlayers) {
          newState[player.id] = false
        }

        // Enable only the clicked player
        newState[playerId] = true

        return newState
      }

      // Normal toggle behavior
      const updated = { ...prev, [playerId]: !prev[playerId] }
      return updated
    })
  }

  // Get filtered players based on enabled state
  const filteredPlayers = createMemo(() => {
    // Get the current enabled state
    const enabled = enabledPlayers()

    // Filter the pre-created player instances
    return playerInstances.filter((player) => enabled[player.id])
  })

  // Generate grid rows and columns from filtered players
  const playerGrid = createMemo(() => {
    const players = filteredPlayers()
    const rows = Math.ceil(players.length / COLUMNS)

    const grid: Player[][] = []

    for (let i = 0; i < rows; i++) {
      const row: Player[] = []
      for (let j = 0; j < COLUMNS; j++) {
        const index = i * COLUMNS + j
        if (index < players.length) {
          row.push(players[index])
        }
      }
      grid.push(row)
    }

    return grid
  })

  // factory function to create a player component
  const createPlayerComponent = (player: Player) => {
    if (!player || !player.component) return null
    return (
      <player.component
        playbackUrl={props.playbackUrl}
        licenseUrl={props.licenseUrl}
      />
    )
  }

  // Create a persistent component map to maintain instance identity
  const PlayerItem = (player: Player) => (
    <div class="player-instance">{createPlayerComponent(player)}</div>
  )

  return (
    <div class="player-grid-container">
      <div class="player-selection">
        <div class="player-checkboxes">
          <For each={availablePlayers}>
            {(player) => (
              <label class="player-checkbox-label">
                <input
                  type="checkbox"
                  checked={enabledPlayers()[player.id] || false}
                  onClick={(e) => togglePlayer(player.id, e)}
                />
                {player.label || player.id}
              </label>
            )}
          </For>
        </div>
      </div>

      <div class="player-grid">
        <For each={playerGrid()}>
          {(row, rowIndex) => (
            <div class="player-grid-row">
              <For each={row}>
                {(player, colIndex) => (
                  <div
                    class="player-cell filled"
                    data-row={rowIndex}
                    data-col={colIndex}
                  >
                    <PlayerItem {...player} />
                  </div>
                )}
              </For>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
