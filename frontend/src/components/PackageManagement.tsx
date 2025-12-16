import { useState, useEffect } from 'react';

interface Package {
  package_id: number;
  worker_id: number;
  name: string;
  description: string | null;
  price: number;
  duration_hours: number;
  services: string[];
  is_active: boolean;
  category_id: number;
  category_name?: string;
}

interface Category {
  category_id: number;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface Props {
  onClose?: () => void;  // Optional - only needed when used as a modal
  embedded?: boolean;    // If true, renders without modal wrapper
}

export default function PackageManagement({ onClose, embedded = false }: Props) {
  const [packages, setPackages] = useState<Package[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [durationHours, setDurationHours] = useState('2');
  const [services, setServices] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadPackages();
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/categories/?active_only=true');
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadPackages = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const response = await fetch('http://127.0.0.1:8000/packages/my-packages', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPackages(data);
      }
    } catch (error) {
      console.error('Failed to load packages:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setPrice('');
    setDurationHours('2');
    setServices('');
    setCategoryId('');
    setEditingPackage(null);
    setShowForm(false);
  };

  const handleEdit = (pkg: Package) => {
    setEditingPackage(pkg);
    setName(pkg.name);
    setDescription(pkg.description || '');
    setPrice(pkg.price.toString());
    setDurationHours(pkg.duration_hours.toString());
    setServices(pkg.services?.join(', ') || '');
    setCategoryId(pkg.category_id.toString());
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !price || !categoryId) {
      alert('Please fill in package name, price, and category');
      return;
    }

    try {
      setSubmitting(true);
      const token = localStorage.getItem('access_token');
      
      const servicesArray = services.split(',').map(s => s.trim()).filter(s => s);
      
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        price: parseFloat(price),
        duration_hours: parseInt(durationHours),
        services: servicesArray,
        category_id: parseInt(categoryId)
      };

      const url = editingPackage 
        ? `http://127.0.0.1:8000/packages/${editingPackage.package_id}`
        : 'http://127.0.0.1:8000/packages/';
      
      const method = editingPackage ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        alert(editingPackage ? '✓ Package updated!' : '✓ Package created!');
        resetForm();
        loadPackages();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to save package');
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save package');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (packageId: number) => {
    if (!confirm('Are you sure you want to delete this package?')) return;

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`http://127.0.0.1:8000/packages/${packageId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        loadPackages();
      } else {
        alert('Failed to delete package');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete package');
    }
  };

  const handleToggleActive = async (pkg: Package) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`http://127.0.0.1:8000/packages/${pkg.package_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_active: !pkg.is_active })
      });

      if (response.ok) {
        loadPackages();
      }
    } catch (error) {
      console.error('Toggle error:', error);
    }
  };

  // Package form JSX
  const packageForm = (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">
          {editingPackage ? '✏️ Edit Package' : '➕ New Package'}
        </h3>
        <button onClick={resetForm} className="text-white/60 hover:text-white text-sm">
          Cancel
        </button>
      </div>

      <div>
        <label className="block text-white font-semibold mb-2">Package Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Basic Cleaning, Deep Clean, Weekly Service"
          className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
        />
      </div>

      <div>
        <label className="block text-white font-semibold mb-2">Category *</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
          required
        >
          <option value="" className="bg-[#4B244A] text-white/50">Select a category</option>
          {categories.map((cat) => (
            <option key={cat.category_id} value={cat.category_id} className="bg-[#4B244A] text-white">
              {cat.name}
            </option>
          ))}
        </select>
        {categories.length === 0 && (
          <p className="text-yellow-300 text-xs mt-1">⚠ No categories available. Contact admin to add categories.</p>
        )}
      </div>

      <div>
        <label className="block text-white font-semibold mb-2">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what's included in this package..."
          rows={3}
          className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-white font-semibold mb-2">Price (₱) *</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="500"
            min="0"
            className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
          />
        </div>

        <div>
          <label className="block text-white font-semibold mb-2">Duration (hours)</label>
          <select
            value={durationHours}
            onChange={(e) => setDurationHours(e.target.value)}
            className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
          >
            <option value="1">1 hour</option>
            <option value="2">2 hours</option>
            <option value="3">3 hours</option>
            <option value="4">4 hours</option>
            <option value="5">5 hours</option>
            <option value="6">6 hours</option>
            <option value="8">8 hours (full day)</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-white font-semibold mb-2">Services Included</label>
        <input
          type="text"
          value={services}
          onChange={(e) => setServices(e.target.value)}
          placeholder="Sweeping, Mopping, Bathroom cleaning (comma separated)"
          className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
        />
        <p className="text-white/50 text-xs mt-1">Separate services with commas</p>
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full py-4 bg-[#EA526F] text-white font-bold rounded-xl hover:bg-[#d64460] transition-all disabled:opacity-50"
      >
        {submitting ? '⏳ Saving...' : editingPackage ? '✓ Update Package' : '✓ Create Package'}
      </button>
    </div>
  );

  // Package list JSX
  const packageList = (
    <div className="space-y-4">
      <button
        onClick={() => setShowForm(true)}
        className="w-full py-4 border-2 border-dashed border-white/30 rounded-xl text-white/70 hover:border-[#EA526F] hover:text-[#EA526F] transition-all"
      >
        ➕ Add New Package
      </button>

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#EA526F]"></div>
        </div>
      ) : packages.length === 0 ? (
        <div className="text-center py-8 bg-white/10 rounded-xl">
          <div className="text-4xl mb-2">📦</div>
          <p className="text-white/70">No packages yet</p>
          <p className="text-white/50 text-sm">Create your first package to get direct bookings!</p>
        </div>
      ) : (
        packages.map((pkg) => (
          <div
            key={pkg.package_id}
            className={`bg-white/10 rounded-xl p-4 border transition-all ${
              pkg.is_active ? 'border-white/20' : 'border-white/10 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-lg font-bold text-white">{pkg.name}</h4>
                  {!pkg.is_active && (
                    <span className="px-2 py-0.5 bg-gray-500/30 text-gray-300 text-xs rounded-full">
                      Inactive
                    </span>
                  )}
                </div>
              {pkg.category_name && (
                <div className="mt-1">
                  <span className="px-2 py-0.5 bg-[#EA526F]/30 text-[#EA526F] text-xs rounded-full">
                    {pkg.category_name}
                  </span>
                </div>
              )}
              </div>
              
              <div className="text-right">
                <div className="text-xl font-bold text-[#EA526F]">
                  ₱{pkg.price.toLocaleString()}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => handleEdit(pkg)}
                    className="px-3 py-1 bg-white/20 text-white text-sm rounded-lg hover:bg-white/30"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleActive(pkg)}
                    className={`px-3 py-1 text-sm rounded-lg ${
                      pkg.is_active 
                        ? 'bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30'
                        : 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                    }`}
                  >
                    {pkg.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleDelete(pkg.package_id)}
                    className="px-3 py-1 bg-red-500/20 text-red-300 text-sm rounded-lg hover:bg-red-500/30"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  // Content to render (form or list)
  const content = showForm ? packageForm : packageList;

  // Embedded mode - no modal wrapper
  if (embedded) {
    return <>{content}</>;
  }

  // Modal mode
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-[#4B244A] to-[#6B3468] rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/20 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-br from-[#4B244A] to-[#6B3468] p-6 border-b border-white/20 z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">📦 My Service Packages</h2>
            {onClose && <button onClick={onClose} className="text-white/60 hover:text-white">✕</button>}
          </div>
          <p className="text-white/60 text-sm mt-1">Create packages that house owners can book directly</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {content}
        </div>
      </div>
    </div>
  );
}
