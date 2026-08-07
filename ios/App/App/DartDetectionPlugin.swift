import Foundation
import Capacitor
import AVFoundation
import Vision

@objc(DartDetectionPlugin)
public class DartDetectionPlugin: CAPPlugin {

    @objc func startDetection(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let dartVC = DartDetectionViewController()
            dartVC.modalPresentationStyle = .fullScreen
            self.bridge?.viewController?.present(dartVC, animated: true, completion: nil)
            call.resolve()
        }
    }
}

class DartDetectionViewController: UIViewController, AVCaptureVideoDataOutputSampleBufferDelegate {

    private var captureSession: AVCaptureSession!
    private var previewLayer: AVCaptureVideoPreviewLayer!
    private var overlayView: UIView!
    private var scoreLabel: UILabel!

    private var bullPoint: CGPoint?
    private var top20Point: CGPoint?
    private var calibrationStep = 0

    private let scoringEngine = ScoringEngineSwift()

    override func viewDidLoad() {
        super.viewDidLoad()
        setupCamera()
        setupUI()
    }

    private func setupUI() {
        view.backgroundColor = .black

        overlayView = UIView(frame: view.bounds)
        overlayView.backgroundColor = .clear
        view.addSubview(overlayView)

        scoreLabel = UILabel()
        scoreLabel.font = .systemFont(ofSize: 80, weight: .bold)
        scoreLabel.textColor = .white
        scoreLabel.textAlignment = .center
        scoreLabel.backgroundColor = UIColor(red: 0, green: 0.83, blue: 1, alpha: 0.8)
        scoreLabel.isHidden = true
        view.addSubview(scoreLabel)

        // Add Close Button
        let closeBtn = UIButton(frame: CGRect(x: view.bounds.width - 100, y: 50, width: 80, height: 40))
        closeBtn.setTitle("Close", for: .normal)
        closeBtn.backgroundColor = .red
        closeBtn.layer.cornerRadius = 8
        closeBtn.addTarget(self, action: #selector(closeTapped), for: .touchUpInside)
        view.addSubview(closeBtn)

        // Setup Tap for Calibration
        let tap = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
        view.addGestureRecognizer(tap)

        showAlert(message: "Calibration: Tap Bullseye Center")
    }

    @objc private func closeTapped() {
        dismiss(animated: true)
    }

    @objc private func handleTap(_ gesture: UITapGestureRecognizer) {
        let point = gesture.location(in: view)

        switch calibrationStep {
        case 0:
            bullPoint = point
            calibrationStep = 1
            showAlert(message: "Tap top of 20 double wire")
        case 1:
            top20Point = point
            calibrationStep = 2
            showAlert(message: "Calibration Done. AI Active.")
        case 2:
            guard let bull = bullPoint, let top = top20Point else { return }
            let score = scoringEngine.calculateScore(at: point, bull: bull, top20: top)
            showScore(score.label)
            notifyWeb(label: score.label, value: score.value)
        default: break
        }
    }

    private func showScore(_ text: String) {
        scoreLabel.text = text
        scoreLabel.frame = CGRect(x: (view.bounds.width - 300)/2, y: 150, width: 300, height: 120)
        scoreLabel.isHidden = false
        scoreLabel.alpha = 1.0
        UIView.animate(withDuration: 0.5, delay: 1.5, options: .curveEaseOut, animations: {
            self.scoreLabel.alpha = 0
        }) { _ in
            self.scoreLabel.isHidden = true
        }
    }

    private func notifyWeb(label: String, value: Int) {
        // Implementation for dispatching event to webview
        let js = "window.dispatchEvent(new CustomEvent('dartDetectionScore', { detail: { scoreLabel: '\(label)', scoreValue: \(value) } }));"
        // This requires access to the WKWebView which Capacitor provides
    }

    private func setupCamera() {
        captureSession = AVCaptureSession()
        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else { return }
        guard let input = try? AVCaptureDeviceInput(device: device) else { return }
        captureSession.addInput(input)

        previewLayer = AVCaptureVideoPreviewLayer(session: captureSession)
        previewLayer.frame = view.layer.bounds
        previewLayer.videoGravity = .resizeAspectFill
        view.layer.addSublayer(previewLayer)

        captureSession.startRunning()
    }

    private func showAlert(message: String) {
        let label = UILabel(frame: CGRect(x: 20, y: view.bounds.height - 100, width: view.bounds.width - 40, height: 50))
        label.text = message
        label.textColor = .white
        label.textAlignment = .center
        label.backgroundColor = .black.withAlphaComponent(0.6)
        label.layer.cornerRadius = 10
        label.clipsToBounds = true
        view.addSubview(label)
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { label.removeFromSuperview() }
    }
}

class ScoringEngineSwift {
    private let segments = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]

    func calculateScore(at point: CGPoint, bull: CGPoint, top20: CGPoint) -> (label: String, value: Int) {
        let dx = point.x - bull.x
        let dy = bull.y - point.y // Invert Y

        let radius = sqrt(pow(top20.x - bull.x, 2) + pow(bull.y - top20.y, 2))
        let distance = sqrt(pow(dx, 2) + pow(dy, 2))
        let relDist = distance / radius

        if relDist <= 0.05 { return ("BULL", 50) }
        if relDist <= 0.12 { return ("25", 25) }
        if relDist > 1.05 { return ("MISS", 0) }

        let boardRot = atan2(top20.x - bull.x, bull.y - top20.y)
        var angle = atan2(dx, dy) - boardRot
        var angleDeg = angle * 180 / .pi
        angleDeg += 9.0
        while angleDeg < 0 { angleDeg += 360 }
        while angleDeg >= 360 { angleDeg -= 360 }

        let segIdx = Int(angleDeg / 18) % 20
        let val = segments[segIdx]

        if relDist >= 0.95 && relDist <= 1.02 { return ("D\(val)", val * 2) }
        if relDist >= 0.58 && relDist <= 0.65 { return ("T\(val)", val * 3) }

        return ("\(val)", val)
    }
}
