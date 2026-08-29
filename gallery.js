chrome.storage.local.get(['extractedImages'], (data) => {
  const gallery = document.getElementById('gallery');
  const images = data.extractedImages || [];
  if (images.length === 0) {
    gallery.innerHTML = "<p>No images found on this page.</p>";
    return;
  }
  images.forEach(src => {
    const card = document.createElement('div');
    card.className = 'img-card';
    const img = document.createElement('img');
    img.src = src;
    const btn = document.createElement('a');
    btn.href = src;
    btn.target = "_blank";
    btn.download = "extracted_image";
    btn.innerText = "Open / Save";
    card.appendChild(img);
    card.appendChild(btn);
    gallery.appendChild(card);
  });
});
