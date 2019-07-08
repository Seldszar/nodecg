let currentPage, linkDestination;
const currentClassName = 'is-current';
const navLinks = document.querySelectorAll('nav li a');

let styleCurrentPageLink = (pathname, hash) => {
    currentPage = `${pathname}${hash || ''}`.trim();
    for (let link of navLinks) {
        linkDestination = `${link.pathname}${link.hash || ''}`.trim();
        link.classList.remove(currentClassName);
        if (linkDestination === currentPage) {
            link.classList.add(currentClassName);
        }
    }
};

styleCurrentPageLink(document.location.pathname, document.location.hash);

document.addEventListener('click', function(event) {
    if (event.target.pathname && event.target.pathname.includes('NodeCG.html')) {
        styleCurrentPageLink(event.target.pathname, event.target.hash);
        return false;
    }
});
