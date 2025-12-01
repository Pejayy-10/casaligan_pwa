"use client";

interface BookingDetailsModalProps {
	isOpen: boolean;
	onClose: () => void;
	booking: {
		booking_id: number;
		worker_name: string;
		worker_email: string;
		worker_phone: string;
		employer_name: string;
		employer_email: string;
		employer_phone: string;
		package_title: string;
		package_description: string;
		package_price: number;
		status: string;
		booking_date: string;
		schedule_date: string;
		start_time: string;
		end_time: string;
		duration: string;
		location: string;
		notes: string;
	} | null;
}

export default function BookingDetailsModal({ isOpen, onClose, booking }: BookingDetailsModalProps) {
	if (!isOpen || !booking) return null;

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		});
	};

	const formatTime = (timeString: string) => {
		if (!timeString || timeString === 'N/A') return 'N/A';
		return timeString;
	};

	const getStatusColor = (status: string) => {
		switch (status.toLowerCase()) {
			case 'ongoing':
				return 'bg-blue-100 text-blue-800 border-blue-200';
			case 'completed':
				return 'bg-green-100 text-green-800 border-green-200';
			case 'cancelled':
				return 'bg-red-100 text-red-800 border-red-200';
			case 'pending':
				return 'bg-yellow-100 text-yellow-800 border-yellow-200';
			case 'confirmed':
				return 'bg-purple-100 text-purple-800 border-purple-200';
			default:
				return 'bg-gray-100 text-gray-800 border-gray-200';
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
			<div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
				{/* Header */}
				<div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
					<h2 className="text-2xl font-bold text-gray-900">Booking Details</h2>
					<button
						onClick={onClose}
						className="text-gray-400 hover:text-gray-600 transition-colors"
					>
						<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				{/* Content */}
				<div className="p-6 space-y-6">
					{/* Package Section */}
					<div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 border border-purple-200">
						<div className="flex items-center justify-between mb-4">
							<h3 className="text-lg font-semibold text-gray-900">Package 1</h3>
							<span className={`px-4 py-1 rounded-full text-sm font-medium border ${getStatusColor(booking.status)}`}>
								● {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
							</span>
						</div>
						
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							{/* Worker Info */}
							<div className="bg-white rounded-lg p-4 shadow-sm">
								<div className="flex items-center gap-3 mb-3">
									<div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center text-white font-bold text-lg">
										{booking.worker_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
									</div>
									<div>
										<p className="text-xs text-gray-500 uppercase font-medium">Worker</p>
										<p className="font-semibold text-gray-900">{booking.worker_name}</p>
									</div>
								</div>
								<div className="space-y-2 text-sm">
									<p className="text-gray-600">
										<span className="font-medium">Email:</span> {booking.worker_email}
									</p>
									<p className="text-gray-600">
										<span className="font-medium">Phone:</span> {booking.worker_phone}
									</p>
								</div>
							</div>

							{/* Employer Info */}
							<div className="bg-white rounded-lg p-4 shadow-sm">
								<div className="flex items-center gap-3 mb-3">
									<div className="w-12 h-12 rounded-full bg-pink-500 flex items-center justify-center text-white font-bold text-lg">
										{booking.employer_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
									</div>
									<div>
										<p className="text-xs text-gray-500 uppercase font-medium">Employer</p>
										<p className="font-semibold text-gray-900">{booking.employer_name}</p>
									</div>
								</div>
								<div className="space-y-2 text-sm">
									<p className="text-gray-600">
										<span className="font-medium">Email:</span> {booking.employer_email}
									</p>
									<p className="text-gray-600">
										<span className="font-medium">Phone:</span> {booking.employer_phone}
									</p>
								</div>
							</div>
						</div>

						{/* Booking Details Grid */}
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
							<div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
								<p className="text-xs text-gray-500 uppercase font-medium mb-1">Booking Date</p>
								<p className="font-semibold text-gray-900">{formatDate(booking.booking_date)}</p>
							</div>
							<div className="bg-pink-50 rounded-lg p-4 border border-pink-200">
								<p className="text-xs text-gray-500 uppercase font-medium mb-1">Service Fee</p>
								<p className="font-semibold text-gray-900">₱{booking.package_price.toFixed(2)}</p>
							</div>
							<div className="bg-cyan-50 rounded-lg p-4 border border-cyan-200">
								<p className="text-xs text-gray-500 uppercase font-medium mb-1">Duration</p>
								<p className="font-semibold text-gray-900">{booking.duration}</p>
							</div>
						</div>
					</div>

					{/* Service Description */}
					<div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
						<h4 className="text-sm font-semibold text-gray-700 uppercase mb-2">Service Description</h4>
						<p className="text-gray-600 text-sm">
							{booking.package_description || 'No description provided'}
						</p>
					</div>

					{/* Location */}
					<div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
						<h4 className="text-sm font-semibold text-gray-700 uppercase mb-2">Location</h4>
						<div className="flex items-start gap-2">
							<svg className="w-5 h-5 text-cyan-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
							</svg>
							<p className="text-gray-600 text-sm">{booking.location || 'Location not specified'}</p>
						</div>
					</div>

					{/* Schedule Details */}
					<div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
						<h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Schedule Details</h4>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
							<div>
								<p className="text-xs text-gray-500 mb-1">Service Date</p>
								<p className="text-sm font-medium text-gray-900">{booking.schedule_date !== 'N/A' ? formatDate(booking.schedule_date) : 'N/A'}</p>
							</div>
							<div>
								<p className="text-xs text-gray-500 mb-1">Start Time</p>
								<p className="text-sm font-medium text-gray-900">{formatTime(booking.start_time)}</p>
							</div>
							<div>
								<p className="text-xs text-gray-500 mb-1">End Time</p>
								<p className="text-sm font-medium text-gray-900">{formatTime(booking.end_time)}</p>
							</div>
						</div>
					</div>

					{/* Additional Notes */}
					{booking.notes && (
						<div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
							<h4 className="text-sm font-semibold text-gray-700 uppercase mb-2">Additional Notes</h4>
							<p className="text-gray-600 text-sm">{booking.notes}</p>
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-end">
					<button
						onClick={onClose}
						className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
					>
						Close
					</button>
				</div>
			</div>
		</div>
	);
}
