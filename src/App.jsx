import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts'
import { DollarSign, ShoppingBag, Calendar, TrendingUp, MapPin, Upload, Trash2, HelpCircle, X } from 'lucide-react'
import { format, parseISO, subYears, isWithinInterval } from 'date-fns'

const defaultCostcoData = []

function App() {
  const [data, setData] = useState(() => {
    const saved = localStorage.getItem('costcoData')
    try {
      return saved ? JSON.parse(saved) : defaultCostcoData
    } catch (e) {
      return defaultCostcoData
    }
  })
  const [dateRange, setDateRange] = useState({
    start: format(subYears(new Date(), 1), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  })
  const [showHelp, setShowHelp] = useState(false)

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const jsonData = JSON.parse(evt.target.result)
        localStorage.setItem('costcoData', JSON.stringify(jsonData))
        setData(jsonData)
      } catch (err) {
        alert('Error parsing JSON file. Please ensure it is a valid Costco data export.')
      }
    }
    reader.readAsText(file)
  }

  const handleClearData = () => {
    localStorage.removeItem('costcoData')
    setData(defaultCostcoData)
  }

  const processedData = useMemo(() => {
    let totalSpent = 0
    let totalItems = 0
    const monthlyDataMap = new Map()
    const itemMap = new Map()
    const warehouseMap = new Map()
    const itemPriceHistoryMap = new Map()

    const filteredData = data.filter(receipt => {
      const date = parseISO(receipt.transactionDate)
      return isWithinInterval(date, {
        start: parseISO(dateRange.start),
        end: parseISO(dateRange.end)
      })
    })

    const sortedData = [...filteredData].sort((a, b) => new Date(a.transactionDate) - new Date(b.transactionDate))

    sortedData.forEach(receipt => {
      totalSpent += receipt.total
      totalItems += receipt.totalItemCount

      const date = parseISO(receipt.transactionDate)
      const monthYear = format(date, 'MMM yyyy')

      // Monthly data
      if (!monthlyDataMap.has(monthYear)) {
        monthlyDataMap.set(monthYear, { month: monthYear, spent: 0, visits: 0, date: date })
      }
      const monthData = monthlyDataMap.get(monthYear)
      monthData.spent += receipt.total
      monthData.visits += 1

      // Item data
      receipt.itemArray.forEach(item => {
        if (item.amount > 0) { // Ignore discounts for item count
          const desc = item.itemDescription01.trim()
          if (!itemMap.has(desc)) {
            itemMap.set(desc, { name: desc, count: 0, total: 0 })
          }
          const itemData = itemMap.get(desc)
          itemData.count += 1
          itemData.total += item.amount

          // Price history
          if (!itemPriceHistoryMap.has(desc)) {
            itemPriceHistoryMap.set(desc, [])
          }
          itemPriceHistoryMap.get(desc).push({
            date: receipt.transactionDate,
            price: item.amount / (item.unit || 1), // Handle multiple units if applicable, though usually 1
            formattedDate: format(date, 'MMM d, yyyy')
          })
        }
      })

      // Warehouse data
      const warehouse = receipt.warehouseName
      if (!warehouseMap.has(warehouse)) {
        warehouseMap.set(warehouse, { name: warehouse, spent: 0, visits: 0 })
      }
      const wData = warehouseMap.get(warehouse)
      wData.spent += receipt.total
      wData.visits += 1
    })

    const monthlyData = Array.from(monthlyDataMap.values()).sort((a, b) => a.date - b.date)
    const topItemsByCount = Array.from(itemMap.values()).sort((a, b) => b.count - a.count).slice(0, 10)
    const topItemsBySpent = Array.from(itemMap.values()).sort((a, b) => b.total - a.total).slice(0, 10)
    const warehouseData = Array.from(warehouseMap.values()).sort((a, b) => b.spent - a.spent)

    return {
      totalSpent,
      totalItems,
      totalVisits: filteredData.length,
      averageSpend: filteredData.length ? totalSpent / filteredData.length : 0,
      monthlyData,
      topItemsByCount,
      topItemsBySpent,
      warehouseData,
      allTransactions: sortedData.reverse(),
      itemPriceHistoryMap,
      allItems: Array.from(itemMap.keys()).filter(item => itemPriceHistoryMap.get(item).length > 1).sort()
    }
  }, [dateRange, data])

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState('')
  const [selectedTransaction, setSelectedTransaction] = useState(null)

  const filteredTransactions = useMemo(() => {
    if (!searchQuery) return processedData.allTransactions.slice(0, 10)
    return processedData.allTransactions.filter(t =>
      t.warehouseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.itemArray.some(item => item.itemDescription01.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  }, [searchQuery, processedData.allTransactions])

  return (
    <div className="app-container">
      <header>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1>Costco Purchase History</h1>
            <p>Analyzing {processedData.totalVisits} visits</p>
          </div>
          <div className="date-range-selector" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <label className="upload-btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <Upload size={18} />
              Load Data
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </label>
            <button onClick={() => setShowHelp(true)} className="icon-btn" title="How to get data">
              <HelpCircle size={18} />
            </button>
            <button onClick={handleClearData} className="clear-btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <Trash2 size={18} />
              Clear Data
            </button>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="search-input"
              style={{ width: 'auto' }}
            />
            <span style={{ color: '#94a3b8' }}>to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="search-input"
              style={{ width: 'auto' }}
            />
          </div>
        </div>
      </header>

      <div className="dashboard-grid">
        <div className="card">
          <div className="stat-label">Total Spent</div>
          <div className="stat-value">${processedData.totalSpent.toFixed(2)}</div>
          <div className="stat-icon"><DollarSign size={24} color="#34d399" /></div>
        </div>
        <div className="card">
          <div className="stat-label">Total Visits</div>
          <div className="stat-value">{processedData.totalVisits}</div>
          <div className="stat-icon"><Calendar size={24} color="#60a5fa" /></div>
        </div>
        <div className="card">
          <div className="stat-label">Avg Spend / Visit</div>
          <div className="stat-value">${processedData.averageSpend.toFixed(2)}</div>
          <div className="stat-icon"><TrendingUp size={24} color="#f87171" /></div>
        </div>
        <div className="card">
          <div className="stat-label">Total Items</div>
          <div className="stat-value">{processedData.totalItems}</div>
          <div className="stat-icon"><ShoppingBag size={24} color="#fbbf24" /></div>
        </div>
      </div>

      <div className="chart-container">
        <h2>Spending Over Time</h2>
        <ResponsiveContainer width="100%" height="90%">
          <LineChart data={processedData.monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="month" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0' }}
              itemStyle={{ color: '#e2e8f0' }}
              formatter={(value) => [`$${value.toFixed(2)}`, 'Spent']}
            />
            <Line type="monotone" dataKey="spent" stroke="#38bdf8" strokeWidth={3} dot={{ fill: '#38bdf8' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-container" id="price-history-section">
        <div className="table-header">
          <h2>Item Price History</h2>
          <input
            list="items-datalist"
            value={selectedItem}
            onChange={(e) => setSelectedItem(e.target.value)}
            className="search-input"
            placeholder="Type to search items..."
            style={{ width: 'auto', minWidth: '300px' }}
          />
          <datalist id="items-datalist">
            {processedData.allItems.map(item => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </div>
        {selectedItem && processedData.itemPriceHistoryMap.has(selectedItem) ? (
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={processedData.itemPriceHistoryMap.get(selectedItem)}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="formattedDate" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Line type="stepAfter" dataKey="price" stroke="#fbbf24" strokeWidth={3} dot={{ fill: '#fbbf24' }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '90%', color: '#94a3b8' }}>
            {selectedItem ? 'Item not found or insufficient data' : 'Select an item to view its price history'}
          </div>
        )}
      </div>

      <div className="dashboard-grid">
        <div className="chart-container" style={{ height: '400px' }}>
          <h2>Top Items by Spend</h2>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={processedData.topItemsBySpent} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis type="number" stroke="#94a3b8" />
              <YAxis dataKey="name" type="category" stroke="#94a3b8" width={150} tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Bar
                dataKey="total"
                fill="#818cf8"
                radius={[0, 4, 4, 0]}
                style={{ cursor: 'pointer' }}
                onClick={(data) => {
                  if (data && data.name) {
                    setSelectedItem(data.name);
                    document.getElementById('price-history-section')?.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-container" style={{ height: '400px' }}>
          <h2>Top Items by Frequency</h2>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={processedData.topItemsByCount} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis type="number" stroke="#94a3b8" />
              <YAxis dataKey="name" type="category" stroke="#94a3b8" width={150} tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Bar
                dataKey="count"
                fill="#34d399"
                radius={[0, 4, 4, 0]}
                style={{ cursor: 'pointer' }}
                onClick={(data) => {
                  if (data && data.name) {
                    setSelectedItem(data.name);
                    document.getElementById('price-history-section')?.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <h2>{searchQuery ? 'Search Results' : 'Recent Transactions'}</h2>
          <div className="search-container">
            <input
              type="text"
              placeholder="Search items or warehouses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Warehouse</th>
              <th>Items</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map((receipt, i) => (
              <tr
                key={i}
                onClick={() => {
                  setSelectedTransaction(receipt);
                  document.getElementById('transaction-details-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
                style={{ cursor: 'pointer' }}
                className={selectedTransaction === receipt ? 'selected-row' : ''}
              >
                <td>{format(parseISO(receipt.transactionDate), 'MMM d, yyyy')}</td>
                <td>{receipt.warehouseName}</td>
                <td>{receipt.totalItemCount}</td>
                <td className="positive">${receipt.total.toFixed(2)}</td>
              </tr>
            ))}
            {filteredTransactions.length === 0 && (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>No transactions found matching "{searchQuery}"</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedTransaction && (
        <div className="table-container" id="transaction-details-section" style={{ marginTop: '2rem' }}>
          <div className="table-header">
            <h2>Transaction Details - {format(parseISO(selectedTransaction.transactionDate), 'MMM d, yyyy')}</h2>
            <div className="stat-label">{selectedTransaction.warehouseName}</div>
          </div>
          <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '1rem' }}>
            <div className="card" style={{ padding: '1rem' }}>
              <div className="stat-label">Total</div>
              <div className="stat-value" style={{ fontSize: '1.5rem' }}>${selectedTransaction.total.toFixed(2)}</div>
            </div>
            <div className="card" style={{ padding: '1rem' }}>
              <div className="stat-label">Items</div>
              <div className="stat-value" style={{ fontSize: '1.5rem' }}>{selectedTransaction.totalItemCount}</div>
            </div>
            <div className="card" style={{ padding: '1rem' }}>
              <div className="stat-label">Taxes</div>
              <div className="stat-value" style={{ fontSize: '1.5rem' }}>${selectedTransaction.taxes.toFixed(2)}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Item Description</th>
                <th>Unit Price</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {selectedTransaction.itemArray.map((item, i) => {
                const isClickable = item.amount > 0 && processedData.itemPriceHistoryMap.has(item.itemDescription01.trim()) && processedData.itemPriceHistoryMap.get(item.itemDescription01.trim()).length > 1;
                return (
                  <tr
                    key={i}
                    onClick={() => {
                      if (isClickable) {
                        setSelectedItem(item.itemDescription01.trim());
                        document.getElementById('price-history-section')?.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    style={{ cursor: isClickable ? 'pointer' : 'default' }}
                    className={isClickable ? 'clickable-row' : ''}
                  >
                    <td style={{ color: isClickable ? '#38bdf8' : 'inherit' }}>
                      {item.itemDescription01}
                      {item.itemDescription02 && <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{item.itemDescription02}</div>}
                    </td>
                    <td>${(item.amount / (item.unit || 1)).toFixed(2)}</td>
                    <td className={item.amount < 0 ? 'negative' : ''}>${item.amount.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showHelp && (
        <div className="modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>How to get your data</h2>
              <button onClick={() => setShowHelp(false)} className="icon-btn"><X size={24} /></button>
            </div>
            <div className="modal-body">
              <ol>
                <li>Download your Costco purchase history from Costco's website, follow instructions <a href="https://github.com/ankurdave/beancount_import_sources/blob/main/download/download_costco_receipts.js" target="_blank" rel="noreferrer">here</a>. If you are not in the US you should go to <code>https://www.costco.&#123;your country tld&#125;/OrderStatusCmd</code></li>
                <li>Load the file to this app. All data will be stored in your browser, there is no server.</li>
                <li>Select the date range you want to view.</li>
                <li>Explore the visualizations and insights.</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
