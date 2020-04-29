import axios from 'axios'

import config from '~/config'
import { parseExtendedAsset } from '~/utils'

export const strict = false

const IP_REGEX = RegExp(/^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]):[0-9]+$/)

export const state = () => ({
  user: null,
  markets: [],
  network: {},

  isMobile: false,
  baseUrl: ''
})

export const mutations = {
  setNetwork: (state, network) => {
    state.network = network
  },

  setUser: (state, user) => state.user = user,
  setMarkets: (state, markets) => state.markets = markets,

  setIsMobile: (state, mobile) => state.isMobile = mobile,
  setBaseUrl: (state, url) => state.baseUrl = url
}

export const actions = {
  init({ dispatch, state }) {
    window.addEventListener('resize', () => dispatch('checkIsMobile'))

    setInterval(() => dispatch('update'), 5000)
  },

  checkIsMobile ({ commit }) {
    commit('setIsMobile', window.innerWidth <= 1000)
  },

  nuxtServerInit ({ commit, rootState }, { req }) {
    const protocol = process.env.isDev ? 'http' : 'https'
    commit('setBaseUrl', `${protocol}://${req.headers.host}`)

    const subdomain = req.headers.host.split('.')

    if (process.env.NETWORK) {
      commit('setNetwork', config.networks[process.env.NETWORK])
    } else if (IP_REGEX.test(req.headers.host)) {
      commit('setNetwork', config.networks.eos)
    } else if (subdomain.length <= 2) {
      commit('setNetwork', config.networks.eos)
    } else {
      commit('setNetwork', config.networks[subdomain[0]])
    }
  },

  update({ dispatch }) {
    dispatch('loadUserBalances')
    //dispatch('loadHistory') TODO Может в будущем обновлять
  },

  async loadMarkets({ state, commit, getters, dispatch }) {
    const { data } = await getters['api/backEnd'].get('/api/markets')
    commit('setMarkets', data)
  },

  loadUserBalances({ rootState, state, commit }) {
    if (state.user) {
      // TODO Вынести этот эндпоинт в конфиг
      axios.get(`${state.network.lightapi}/api/account/${state.network.name}/${rootState.user.name}`).then((r) => {
        const balances = r.data.balances
        balances.sort((a, b) => {
          if (a.currency < b.currency) { return -1 }
          if (a.currency > b.currency) { return 1 }

          return 0
        })

        balances.map(b => b.id = b.currency + '@' + b.contract)

        commit('setUser', { ...state.user, balances }, { root: true })
      })
    }
  }
}

export const getters = {
  user(state) {
    return state.user
  },

  baseBalance(state) {
    if (!state.user || !state.user.balances) return '0.0000 ' + state.network.baseToken.symbol

    const balance = state.user.balances.filter(b => b.currency === state.network.baseToken.symbol)[0]
    if (!balance) return '0.0000 ' + state.network.baseToken.symbol

    return `${balance.amount} ${balance.currency}`
  },

  tokenBalance(state) {
    if (!state.user || !state.user.balances || !state.market.token.symbol) return '0.0000'
    const balance = state.user.balances.filter((b) => {
      return b.currency === state.market.token.symbol.name &&
             b.contract === state.market.token.contract
    })[0]

    if (balance)
      return `${balance.amount} ${balance.currency}`
    else
      return Number(0).toFixed(state.market.token.symbol.precision) + ` ${state.market.token.symbol.name}`
  }
}
