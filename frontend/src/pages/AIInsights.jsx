import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { aiApi, productsApi } from '../services/api'

const QUICK_PROMPTS = [
  'Which products are at risk of stockout in the next 30 days?',
  'What are my top-selling categories?',
  'Show me reorder recommendations',
  'Identify dead stock items',
  'How can I reduce inventory carrying costs?',
  'What should I reorder this week?',
]

export default function AIInsights() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Good day! I'm your AI inventory assistant powered by Gemini. I can analyze your inventory data, predict demand, identify dead stock, suggest reorder quantities, and answer any inventory-related questions. What would you like to explore?",
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [activePanel, setActivePanel] = useState('chat') // chat | reorder | deadstock
  const bottomRef = useRef()
  const inputRef = useRef()

  const { data: productsData } = useQuery({
    queryKey: ['products-for-ai'],
    queryFn: () => productsApi.list({ limit: 200 }).then(r => r.data.products),
  })

  const chatMutation = useMutation({
    mutationFn: (msgs) => aiApi.chat(msgs),
    onSuccess: (res) => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.data.response,
        timestamp: new Date()
      }])
    },
    onError: (err) => {
      const msg = err.response?.data?.error || 'AI unavailable. Please check your Gemini API key.'
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ ${msg}`,
        timestamp: new Date(),
        error: true
      }])
    }
  })

  const reorderMutation = useMutation({
    mutationFn: () => aiApi.reorderSuggestions(),
    onError: (err) => toast.error(err.response?.data?.error || 'AI unavailable'),
  })

  const deadStockMutation = useMutation({
    mutationFn: () => aiApi.deadStock(60),
    onError: (err) => toast.error(err.response?.data?.error || 'AI unavailable'),
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = (text) => {
    const msg = text || input.trim()
    if (!msg) return
    const userMsg = { role: 'user', content: msg, timestamp: new Date() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    chatMutation.mutate(newMessages.map(m => ({ role: m.role, content: m.content })))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-surface">
      {/* Chat Area */}
      <section className={`flex flex-col ${activePanel !== 'chat' ? 'hidden md:flex md:flex-1' : 'flex-1'}`}>
        {/* Chat header */}
        <div className="px-8 py-5 border-b border-surface-container-low flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white">
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
            </div>
            <div>
              <h2 className="font-bold text-on-surface">AI Inventory Assistant</h2>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                <p className="text-xs text-on-surface-variant">Powered by Gemini 2.0 Flash</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setActivePanel('reorder'); reorderMutation.mutate() }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${activePanel === 'reorder' ? 'bg-primary text-white' : 'bg-surface-container-highest text-on-surface hover:bg-surface-container-high'}`}>
              <span className="material-symbols-outlined text-[16px]">local_shipping</span>
              Reorder
            </button>
            <button
              onClick={() => { setActivePanel('deadstock'); deadStockMutation.mutate() }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${activePanel === 'deadstock' ? 'bg-primary text-white' : 'bg-surface-container-highest text-on-surface hover:bg-surface-container-high'}`}>
              <span className="material-symbols-outlined text-[16px]">inventory</span>
              Dead Stock
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 scrollbar-thin">
          {/* Quick prompts - only show at start */}
          {messages.length === 1 && (
            <div className="grid grid-cols-2 gap-2 max-w-xl">
              {QUICK_PROMPTS.map(prompt => (
                <button key={prompt} onClick={() => sendMessage(prompt)}
                  className="text-left px-4 py-3 bg-surface-container-lowest rounded-xl text-xs font-medium text-on-surface hover:bg-surface-container-low border border-surface-container-high transition-colors editorial-shadow">
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 max-w-3xl ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                msg.role === 'assistant' ? 'bg-primary text-white' : 'bg-surface-container-high text-on-surface'
              }`}>
                <span className="material-symbols-outlined text-[16px]" style={msg.role === 'assistant' ? { fontVariationSettings: "'FILL' 1" } : {}}>
                  {msg.role === 'assistant' ? 'smart_toy' : 'person'}
                </span>
              </div>

              {/* Bubble */}
              <div className="space-y-1">
                <div className={`rounded-2xl px-5 py-4 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-primary text-white rounded-tr-sm'
                    : msg.error
                      ? 'bg-tertiary-fixed/20 text-on-surface border border-tertiary-fixed rounded-tl-sm'
                      : 'bg-surface-container-lowest text-on-surface shadow-sm border border-surface-container-high rounded-tl-sm'
                }`}>
                  {msg.content}
                </div>
                <p className={`text-[10px] text-on-surface-variant px-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                  {format(new Date(msg.timestamp), 'h:mm a')}
                </p>
              </div>
            </div>
          ))}

          {chatMutation.isPending && (
            <div className="flex gap-3 max-w-3xl">
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-white flex-shrink-0">
                <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
              </div>
              <div className="bg-surface-container-lowest rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm border border-surface-container-high">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="w-2 h-2 bg-primary/40 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  <span className="text-xs text-on-surface-variant">Analyzing your inventory...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-8 py-5 border-t border-surface-container-low flex-shrink-0">
          <div className="flex items-end gap-3 bg-surface-container-lowest rounded-2xl border border-surface-container-high p-3 shadow-sm">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about inventory, demand, reorders, dead stock..."
              rows={1}
              className="flex-1 bg-transparent border-none resize-none text-sm focus:ring-0 outline-none text-on-surface placeholder:text-on-surface-variant max-h-32 overflow-y-auto scrollbar-thin"
              style={{ minHeight: '24px' }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || chatMutation.isPending}
              className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center flex-shrink-0 hover:opacity-90 active:scale-95 transition-all disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
            </button>
          </div>
          <p className="text-[10px] text-on-surface-variant text-center mt-2">Press Enter to send · Shift+Enter for new line</p>
        </div>
      </section>

      {/* Side Panel - Reorder or Dead Stock */}
      {activePanel !== 'chat' && (
        <aside className="w-full md:w-[420px] border-l border-surface-container-low flex flex-col bg-surface-container-lowest overflow-hidden">
          <div className="px-6 py-5 border-b border-surface-container-low flex items-center justify-between flex-shrink-0">
            <h3 className="font-bold text-on-surface">
              {activePanel === 'reorder' ? '🚚 Reorder Suggestions' : '📦 Dead Stock Analysis'}
            </h3>
            <button onClick={() => setActivePanel('chat')}
              className="p-2 rounded-lg hover:bg-surface-container-low transition-colors">
              <span className="material-symbols-outlined text-on-surface-variant">close</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
            {/* Reorder Panel */}
            {activePanel === 'reorder' && (
              <>
                {reorderMutation.isPending ? (
                  <div className="space-y-4">
                    {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-28 rounded-xl" />)}
                  </div>
                ) : reorderMutation.data ? (
                  <>
                    {reorderMutation.data.data.summary && (
                      <div className="bg-primary-fixed/30 rounded-xl p-4 mb-4 text-sm text-on-surface leading-relaxed">
                        {reorderMutation.data.data.summary}
                      </div>
                    )}
                    <div className="space-y-3">
                      {(reorderMutation.data.data.recommendations || []).map((rec, i) => (
                        <div key={i} className={`rounded-xl p-4 border ${
                          rec.urgency === 'critical' ? 'border-tertiary/30 bg-tertiary-fixed/10' :
                          rec.urgency === 'high' ? 'border-yellow-200 bg-yellow-50' :
                          'border-surface-container-high bg-white'
                        }`}>
                          <div className="flex items-start justify-between mb-2">
                            <p className="text-sm font-bold text-on-surface">{rec.product_name}</p>
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              rec.urgency === 'critical' ? 'bg-tertiary text-white' :
                              rec.urgency === 'high' ? 'bg-yellow-400 text-yellow-900' :
                              'bg-surface-container text-on-surface-variant'
                            }`}>{rec.urgency}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs text-on-surface-variant mb-2">
                            <div>Current: <span className="font-bold text-on-surface">{rec.current_stock}</span></div>
                            <div>Order qty: <span className="font-bold text-secondary">{rec.suggested_order_qty}</span></div>
                            <div className="col-span-2">Stockout in: <span className="font-bold text-tertiary">{rec.estimated_stockout_days} days</span></div>
                          </div>
                          <p className="text-xs text-on-surface-variant leading-relaxed">{rec.reason}</p>
                        </div>
                      ))}
                      {(reorderMutation.data.data.recommendations || []).length === 0 && (
                        <div className="text-center py-8">
                          <span className="material-symbols-outlined text-4xl text-secondary block mb-2" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                          <p className="text-sm font-semibold text-on-surface">All stocked up!</p>
                          <p className="text-xs text-on-surface-variant mt-1">No urgent reorders needed right now.</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-3 block">local_shipping</span>
                    <p className="text-sm text-on-surface-variant">Click "Reorder" to analyze your stock levels</p>
                  </div>
                )}
              </>
            )}

            {/* Dead Stock Panel */}
            {activePanel === 'deadstock' && (
              <>
                {deadStockMutation.isPending ? (
                  <div className="space-y-4">
                    {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-28 rounded-xl" />)}
                  </div>
                ) : deadStockMutation.data ? (
                  <>
                    <div className="bg-surface-container-low rounded-xl p-4 mb-4 text-xs font-semibold text-on-surface-variant">
                      Total dead stock value:{' '}
                      <span className="text-tertiary text-base font-bold">
                        ${(deadStockMutation.data.data.total_dead_stock_value || 0).toLocaleString()}
                      </span>
                    </div>
                    {deadStockMutation.data.data.insight && (
                      <div className="bg-primary-fixed/20 rounded-xl p-4 mb-4 text-sm text-on-surface leading-relaxed">
                        {deadStockMutation.data.data.insight}
                      </div>
                    )}
                    <div className="space-y-3">
                      {(deadStockMutation.data.data.recommendations || []).map((rec, i) => (
                        <div key={i} className="bg-white rounded-xl p-4 border border-surface-container-high">
                          <div className="flex items-start justify-between mb-2">
                            <p className="text-sm font-bold text-on-surface">{rec.product_name}</p>
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">
                              {rec.action?.replace(/_/g, ' ')}
                            </span>
                          </div>
                          {rec.suggested_discount_pct && (
                            <p className="text-sm font-bold text-primary mb-1">
                              Suggest {rec.suggested_discount_pct}% discount
                            </p>
                          )}
                          <p className="text-xs text-on-surface-variant leading-relaxed">{rec.reason}</p>
                        </div>
                      ))}
                      {(deadStockMutation.data.data.recommendations || []).length === 0 && (
                        <div className="text-center py-8">
                          <span className="material-symbols-outlined text-4xl text-secondary block mb-2" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                          <p className="text-sm font-semibold text-on-surface">No dead stock!</p>
                          <p className="text-xs text-on-surface-variant mt-1">All products have recent sales activity.</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-3 block">inventory</span>
                    <p className="text-sm text-on-surface-variant">Analyzing dead stock...</p>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>
      )}
    </div>
  )
}
